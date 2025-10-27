import { Web3Provider } from "../components/providers";
import PushChainProvider from "../components/providers/PushChainProvider";
import { PushUniversalWalletProvider } from '@pushchain/ui-kit';
import { PushUI } from '@pushchain/ui-kit';
import '../styles/globals.css'

function MyApp({ Component, pageProps }) {
  const walletConfig = {
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
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
