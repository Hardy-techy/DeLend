import * as MockTokensModule from "../abis/MockTokens.json"; // Your deployed Mock tokens ABI
import usdcImg from "../assets/usdc.png";
import usdtImg from "../assets/usdtt.png";
import wethImg from "../assets/ethereum.png";

const tokenImages = {
  USDC: usdcImg,
  USDT: usdtImg,
  WETH: wethImg,
  ADE: usdcImg, // Placeholder
  LAR: wethImg, // Placeholder
};

// Extract ABI correctly
let MockTokens;
if (Array.isArray(MockTokensModule)) {
  MockTokens = MockTokensModule;
} else if (MockTokensModule.abi && Array.isArray(MockTokensModule.abi)) {
  MockTokens = MockTokensModule.abi;
} else if (MockTokensModule.default && Array.isArray(MockTokensModule.default)) {
  MockTokens = MockTokensModule.default;
} else {
  MockTokens = MockTokensModule; // Fallback
}

// Set to false for better performance in production
const DEBUG_MODE = false;

export const normalizeToken = async (web3, contract, currentToken, connectedAccount = null) => {
  // Convert from token units to human-readable based on actual decimals
  const fromTokenUnits = (amount, decimals) => {
    return (Number(amount) / (10 ** Number(decimals))).toString();
  };

  const toBN = (amount) => {
    return web3.utils.toBN(amount);
  };

  const account = connectedAccount || null;
  const tokenInst = new web3.eth.Contract(MockTokens, currentToken.tokenAddress);

  // OPTIMIZATION 1: Run ALL independent calls in PARALLEL
  const [
    decimals,
    walletBalance,
    totalSuppliedInContract,
    totalBorrowedInContract,
    userTokenBorrowedAmount,
    userTokenLentAmount,
    userTotalAmountAvailableToWithdrawInDollars,
    userTotalAmountAvailableForBorrowInDollars,
    priceResult
  ] = await Promise.all([
    tokenInst.methods.decimals().call(),
    account ? tokenInst.methods.balanceOf(account).call().catch(() => "0") : Promise.resolve("0"),
    contract.methods.getTotalTokenSupplied(currentToken.tokenAddress).call(),
    contract.methods.getTotalTokenBorrowed(currentToken.tokenAddress).call(),
    account ? contract.methods.tokensBorrowedAmount(currentToken.tokenAddress, account).call() : Promise.resolve("0"),
    account ? contract.methods.tokensLentAmount(currentToken.tokenAddress, account).call() : Promise.resolve("0"),
    account ? contract.methods.getTokenAvailableToWithdraw(account).call() : Promise.resolve("0"),
    account ? contract.methods.getUserTotalAmountAvailableForBorrowInDollars(account).call() : Promise.resolve("0"),
    contract.methods.oneTokenEqualsHowManyDollars(currentToken.tokenAddress).call()
  ]);

  const price = priceResult[0];
  const priceDecimals = priceResult[1];
  const oneTokenToDollar = parseFloat(price) / (10 ** parseInt(priceDecimals));

  const utilizationRate = Number(totalSuppliedInContract) > 0 
    ? (Number(totalBorrowedInContract) * 100) / Number(totalSuppliedInContract) 
    : 0;

  const availableAmountInContract = toBN(totalSuppliedInContract).sub(toBN(totalBorrowedInContract)).toString();

  // OPTIMIZATION 2: Convert to dollars using oneTokenToDollar (already have it!) instead of more contract calls
  const walletBalanceInDollars = web3.utils.toWei((fromTokenUnits(walletBalance, decimals) * oneTokenToDollar).toString());
  const totalSuppliedInContractInDollars = web3.utils.toWei((fromTokenUnits(totalSuppliedInContract, decimals) * oneTokenToDollar).toString());
  const totalBorrowedInContractInDollars = web3.utils.toWei((fromTokenUnits(totalBorrowedInContract, decimals) * oneTokenToDollar).toString());
  const userTokenBorrowedAmountInDollars = web3.utils.toWei((fromTokenUnits(userTokenBorrowedAmount, decimals) * oneTokenToDollar).toString());
  const userTokenLentAmountInDollars = web3.utils.toWei((fromTokenUnits(userTokenLentAmount, decimals) * oneTokenToDollar).toString());
  const availableAmountInContractInDollars = web3.utils.toWei((fromTokenUnits(availableAmountInContract, decimals) * oneTokenToDollar).toString())


  return {
    name: currentToken.name,
    image: tokenImages[currentToken.name],
    tokenAddress: currentToken.tokenAddress,
    userTotalAmountAvailableToWithdrawInDollars: web3.utils.fromWei(userTotalAmountAvailableToWithdrawInDollars), // Dollars are always 18 decimals
    userTotalAmountAvailableForBorrowInDollars: web3.utils.fromWei(userTotalAmountAvailableForBorrowInDollars), // Dollars are always 18 decimals
    walletBalance: {
      amount: fromTokenUnits(walletBalance, decimals), // Use actual token decimals
      inDollars: web3.utils.fromWei(walletBalanceInDollars), // Dollars are always 18 decimals
    },
    totalSuppliedInContract: {
      amount: fromTokenUnits(totalSuppliedInContract, decimals), // Use actual token decimals
      inDollars: web3.utils.fromWei(totalSuppliedInContractInDollars), // Dollars are always 18 decimals
    },
    totalBorrowedInContract: {
      amount: fromTokenUnits(totalBorrowedInContract, decimals), // Use actual token decimals
      inDollars: web3.utils.fromWei(totalBorrowedInContractInDollars), // Dollars are always 18 decimals
    },
    availableAmountInContract: {
      amount: fromTokenUnits(availableAmountInContract, decimals), // Use actual token decimals
      inDollars: web3.utils.fromWei(availableAmountInContractInDollars), // Dollars are always 18 decimals
    },
    userTokenBorrowedAmount: {
      amount: fromTokenUnits(userTokenBorrowedAmount, decimals), // Use actual token decimals
      inDollars: web3.utils.fromWei(userTokenBorrowedAmountInDollars), // Dollars are always 18 decimals
    },
    userTokenLentAmount: {
      amount: fromTokenUnits(userTokenLentAmount, decimals), // Use actual token decimals
      inDollars: web3.utils.fromWei(userTokenLentAmountInDollars), // Dollars are always 18 decimals
    },
    LTV: web3.utils.fromWei(currentToken.LTV),
    borrowAPYRate: web3.utils.fromWei(currentToken.stableRate),
    utilizationRate: utilizationRate,
    oneTokenToDollar,
    decimals
  };
};
