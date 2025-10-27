import useSWR from "swr";
import { normalizeToken } from "../../../../utils/normalize";

const NETWORKS = {
  1: "Ethereum Main Network",
  3: "Ropsten Test Network",
  4: "Rinkeby Test Network",
  5: "Goerli Test Network",
  42: "Kovan Test Network",
  11155111: "Sepolia Test Network",
  56: "Binance Smart Chain",
  1337: "Ganache",
};

export const handler = (web3, contract, connectedAccount) => () => {
  // connectedAccount is passed as a parameter from setupHooks

  const { data, error, mutate, isValidating, ...rest } = useSWR(
    // ALWAYS return a key, even if web3 is null - this ensures the hook is ready
    `web3/your_borrows/${web3 && contract ? (connectedAccount || 'no-account') : 'loading'}`,
    async () => {
      // Don't fetch if web3/contract not ready
      if (!web3 || !contract) {
        return { yourBorrows: [], yourBalance: 0 };
      }
      
      // Return empty data immediately if no wallet connected
      if (!connectedAccount) {
        return { yourBorrows: [], yourBalance: 0 };
      }
      
      const account = connectedAccount;

      const yourBorrows = [];
      let yourBalance = 0;
      const tokenAddressTracker = [];

      const noOfTokensBorrowed = await contract.methods.noOfTokensBorrowed().call();

      if (Number(noOfTokensBorrowed) > 0) {
        // OLD token addresses to filter out (6 decimal versions)
        const OLD_TOKENS = [
          '0x63A02A958e9803a92b849d802f2A452922733F56'.toLowerCase(), // OLD USDC (6 decimals)
          '0x51BD80d3102cFC1F22dD7024C99A6E163aA672fF'.toLowerCase()  // OLD USDT (6 decimals)
        ];

        // OPTIMIZATION: Fetch all token addresses in PARALLEL
        const addressPromises = [];
        for (let i = 0; i < Number(noOfTokensBorrowed); i++) {
          addressPromises.push(contract.methods.tokensBorrowed(i, account).call());
        }
        const tokenAddresses = await Promise.all(addressPromises);

        // Filter unique, non-zero, non-old addresses
        const uniqueAddresses = [...new Set(tokenAddresses)]
          .filter(addr => 
            addr !== "0x0000000000000000000000000000000000000000" &&
            !OLD_TOKENS.includes(addr.toLowerCase())
          );

        // Fetch all token data and normalize in PARALLEL
        const tokenPromises = uniqueAddresses.map(async (addr) => {
          const currentToken = await contract.methods.getTokenFrom(addr).call();
          return normalizeToken(web3, contract, currentToken, connectedAccount);
        });

        const normalizedTokens = await Promise.all(tokenPromises);

        // Only include tokens with borrow amount > 0
        for (const normalized of normalizedTokens) {
          if (Number(normalized.userTokenBorrowedAmount.amount) > 0) {
            yourBorrows.push(normalized);
            yourBalance += parseFloat(normalized.userTokenBorrowedAmount.inDollars);
          }
        }

      }
      return { yourBorrows, yourBalance };
    },
    {
      refreshInterval: 0, // Disable auto-refresh (only manual refresh)
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      dedupingInterval: 0, // Allow immediate refresh after transactions
      keepPreviousData: true, // Keep data visible during refresh for smooth UX
    }
  );

  const targetNetwork = NETWORKS["11155111"];

  return {
    data,
    error,
    mutate, // Expose mutate for manual refresh
    isValidating,
    ...rest,
    target: targetNetwork,
    isSupported: data === targetNetwork,
  };
};

/**

web3.eth.net.getId() will return the network id on ganache itself
web3.eth.getChainId() will return the chainId of ganache in metamask.

chainChanged event listens with web3.eth.getChainId()


 */
