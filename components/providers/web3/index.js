import { createContext, useContext, useState, useEffect, useMemo } from "react";
import detectEthereumProvider from "@metamask/detect-provider";
import Web3 from "web3";
import { setupHooks } from "./hooks/setupHooks";
import { loadContract } from "../../../utils/loadContract";
import { usePushWalletContext, usePushChainClient } from '@pushchain/ui-kit';
import { usePushChain } from "../PushChainProvider";

const Web3Context = createContext(null);

const setListeners = (provider) => {
  provider.on("chainChanged", (_) => window.location.reload());
};

export default function Web3Provider({ children }) {
  // Get Push Chain context (TRUE universal functionality)
  const pushChainContext = usePushChain();
  
  // Get Push Chain wallet from UI-kit (for UI display)
  const pushWallet = usePushWalletContext();
  const pushClient = usePushChainClient();

  // Initialize with empty hooks to prevent null errors
  const [web3Api, setWeb3Api] = useState(() => ({
    web3: null,
    provider: null,
    contract: null,
    isLoading: true,
    hooks: setupHooks({ web3: null, provider: null, contract: null, connectedAccount: null }),
  }));

  // Track connected account separately to control hook recreation
  const [connectedAccountState, setConnectedAccountState] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const loadProvider = async () => {
      if (!mounted) return;
      
      // ALWAYS use Push Chain RPC directly (most reliable)
      const PUSH_CHAIN_RPC = process.env.NEXT_PUBLIC_PUSH_RPC_URL || 'https://evm.rpc-testnet-donut-node1.push.org/';
      
      const web3 = new Web3(PUSH_CHAIN_RPC);
      const contract = await loadContract("LendingAndBorrowing", web3);
      
      if (!mounted) return;
      
      // Get MetaMask for transactions (optional)
      const metamaskProvider = await detectEthereumProvider();
      
      if (metamaskProvider) {
        setWeb3Api({
          web3,
          provider: metamaskProvider,
          contract,
          isLoading: false,
          hooks: null, // Will be set in useMemo
        });
        setListeners(metamaskProvider);
      } else {
        setWeb3Api({
          web3,
          provider: null,
          contract,
          isLoading: false,
          hooks: null, // Will be set in useMemo
        });
      }
    };

    loadProvider();
    
    return () => {
      mounted = false;
    };
  }, []); // Run ONCE on mount

  // Update connected account when wallet context changes
  useEffect(() => {
    let newAccount = null;
    
    if (pushChainContext?.account && pushChainContext?.isUniversal) {
      newAccount = pushChainContext.account;
    } else if (pushWallet?.universalAccount?.address) {
      newAccount = pushWallet.universalAccount.address;
    } else if (pushWallet?.universalAccount?.account) {
      newAccount = pushWallet.universalAccount.account;
    } else if (pushWallet?.universalAccount && typeof pushWallet.universalAccount === 'string') {
      newAccount = pushWallet.universalAccount;
    } else if (pushWallet?.account?.address) {
      newAccount = pushWallet.account.address;
    } else if (pushWallet?.account && typeof pushWallet.account === 'string') {
      newAccount = pushWallet.account;
    } else if (web3Api.provider?.selectedAddress) {
      newAccount = web3Api.provider.selectedAddress;
    }
    
    if (newAccount !== connectedAccountState) {
      console.log('👛 Account changed:', connectedAccountState, '→', newAccount);
      setConnectedAccountState(newAccount);
    }
  }, [
    pushChainContext?.account,
    pushChainContext?.isUniversal,
    pushWallet?.universalAccount,
    pushWallet?.account,
    web3Api.provider?.selectedAddress
  ]);

  const _web3Api = useMemo(() => {
    const { web3, provider, isLoading, contract } = web3Api;

    // Use the tracked connected account
    const connectedAccount = connectedAccountState;
    let isUniversal = false;
    
    // Determine if using universal signer
    if (pushChainContext?.account && pushChainContext?.isUniversal) {
      isUniversal = true;
    }

    // CRITICAL: Always create hooks, even when web3 is null
    // The hooks themselves check for web3/contract before fetching
    const hooks = setupHooks({ web3, provider, contract, connectedAccount });

    return {
      web3,
      provider,
      contract,
      isLoading,
      hooks,
      pushWallet, // Expose Push wallet context (UI-kit)
      pushClient, // Expose Push client (UI-kit)
      pushChainContext, // Expose Push Chain context (SDK)
      connectedAccount, // The actual connected address
      isUniversal, // TRUE if using universal signer
      chainId: pushChainContext?.chainId, // User's current chain
      universalSigner: pushChainContext?.universalSigner, // For universal transactions
      requireInstall: !isLoading && !web3,
      connect: provider
        ? async () => {
            try {
              await provider.request({
                method: "eth_requestAccounts",
              });
            } catch {
              location.reload();
            }
          }
        : () => {},
    };
  }, [
    web3Api,
    web3Api.web3, // CRITICAL: Track web3 changes
    web3Api.contract, // CRITICAL: Track contract changes
    connectedAccountState,
    pushClient,
    pushChainContext?.chainId,
    pushChainContext?.isUniversal,
    pushChainContext?.universalSigner,
  ]);

  // Return another instance of _web3Api if web3Api changes

  return (
    <Web3Context.Provider value={_web3Api}>{children}</Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}

export function useHooks(callback) {
  const { hooks } = useWeb3();
  return callback(hooks);
}

/*

getHooks() method returns a dictionary containing name of the hook (key) and the handler to the hook (value)
That dictionary will be accessible anywhere useHooks() method is called because the dictionary is passed as an argument to the callback.

*/
