import { createContext, useContext, useState, useEffect } from "react";
import { PushChain } from '@pushchain/core';
import detectEthereumProvider from "@metamask/detect-provider";
import { ethers } from "ethers";

const PushChainContext = createContext(null);

/**
 * Universal Web3 Provider using Push Chain SDK
 * This allows users from ANY chain to interact with contracts on Push Chain
 */
export default function PushChainProvider({ children }) {
  const [pushState, setPushState] = useState({
    pushClient: null,
    universalSigner: null,
    account: null,
    chainId: null,
    isLoading: true,
    isUniversal: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    
    const initializePushChain = async () => {
      try {
        // Detect MetaMask or any Ethereum provider
        const provider = await detectEthereumProvider({ silent: true });
        
        if (!provider) {
          if (mounted) {
            setPushState(prev => ({ 
              ...prev, 
              isLoading: false,
              error: "No wallet provider found"
            }));
          }
          return;
        }

        // Check if accounts are already connected (don't force request)
        let accounts = [];
        try {
          accounts = await provider.request({ method: 'eth_accounts' }); // Non-intrusive check
        } catch (err) {
          // Silent fail
        }

        if (accounts.length === 0) {
          if (mounted) {
            setPushState(prev => ({ 
              ...prev, 
              isLoading: false,
              error: null // Not an error, just not connected yet
            }));
          }
          
          // Listen for when wallet gets connected
          provider.on('accountsChanged', async (newAccounts) => {
            if (newAccounts.length > 0) {
              window.location.reload(); // Reload to initialize properly
            }
          });
          
          return;
        }

        // Get chainId
        const chainId = await provider.request({ method: 'eth_chainId' });

        // Create ethers provider and signer (ethers v5 syntax)
        const ethersProvider = new ethers.providers.Web3Provider(provider);
        const signer = ethersProvider.getSigner(); // No await in v5

        // Convert to Universal Signer (Push Chain magic!)
        const universalSigner = await PushChain.utils.signer.toUniversal(signer);

        // Initialize Push Chain Client
        const pushChainClient = await PushChain.initialize(universalSigner, {
          network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
        });

        if (mounted) {
          setPushState({
            pushClient: pushChainClient,
            universalSigner: universalSigner,
            account: accounts[0],
            chainId: chainId,
            isLoading: false,
            isUniversal: true,
            error: null,
          });
        }

        // Listen for account changes
        provider.on('accountsChanged', (newAccounts) => {
          if (newAccounts.length === 0) {
            if (mounted) {
              setPushState(prev => ({ 
                ...prev, 
                account: null,
                pushClient: null,
                universalSigner: null,
                isUniversal: false
              }));
            }
          } else {
            window.location.reload();
          }
        });

        // Listen for chain changes
        provider.on('chainChanged', () => {
          window.location.reload();
        });

      } catch (error) {
        if (mounted) {
          setPushState(prev => ({ 
            ...prev, 
            isLoading: false,
            error: error.message
          }));
        }
      }
    };

    initializePushChain();
    
    return () => {
      mounted = false;
    };
  }, []);

  const value = {
    ...pushState,
    isConnected: !!pushState.account && !!pushState.pushClient,
  };

  return (
    <PushChainContext.Provider value={value}>
      {children}
    </PushChainContext.Provider>
  );
}

/**
 * Hook to access Push Chain context
 */
export function usePushChain() {
  const context = useContext(PushChainContext);
  if (!context) {
    throw new Error("usePushChain must be used within PushChainProvider");
  }
  return context;
}

