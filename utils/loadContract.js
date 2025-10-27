import * as LendingAndBorrowingModule from '../abis/LendingAndBorrowing.json'


export const loadContract = async (contractName, web3) => {
  let contract = null;

  try {
    // Use environment variable for Push Chain deployment
    const contractAddress = process.env.NEXT_PUBLIC_LENDING_CONTRACT_ADDRESS;
    
    if (!contractAddress) {
      return null;
    }
    
    // Extract ABI - it's in the .abi property!
    const abi = LendingAndBorrowingModule.abi || LendingAndBorrowingModule.default?.abi || LendingAndBorrowingModule;
    
    if (!Array.isArray(abi)) {
      return null;
    }
    
    contract = new web3.eth.Contract(
      abi,
      contractAddress
    );
  }
  catch (err) {
    // Silent fail
  }

  return contract;
};
