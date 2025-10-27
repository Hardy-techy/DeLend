import { Web3Provider } from "../components/providers";
import PushChainProvider from "../components/providers/PushChainProvider";
import { PushUniversalWalletProvider } from '@pushchain/ui-kit';
import { PushUI } from '@pushchain/ui-kit';
import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  const walletConfig = {
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    onError: (error) => {
      // Suppress sodium_init errors (known Push Protocol issue)
      if (!error?.message?.includes('sodium')) {
        console.error('Push Wallet Error:', error);
      }
    }
  };

  return(
    <PushUniversalWalletProvider config={walletConfig}>
      <PushChainProvider>
        <Web3Provider>
          <Component {...pageProps} />
        </Web3Provider>
      </PushChainProvider>
    </PushUniversalWalletProvider>
  )
}

export default MyApp
