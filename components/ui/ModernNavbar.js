import { PushUniversalAccountButton } from '@pushchain/ui-kit';
import { useWeb3 } from '../providers/web3';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ModernNavbar() {
  const { isUniversal, chainId } = useWeb3();
  const router = useRouter();

  return (
    <nav className="bg-[#0B0E14]/95 border-b border-black backdrop-blur-xl sticky top-0 z-50 shadow-lg shadow-black/20">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-10">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <img 
                    src="/logo.png" 
                    alt="DeLend" 
                    className="h-32 w-auto object-contain transition-all duration-300 group-hover:scale-105"
                  />
                </div>
              </div>
            </Link>
          </div>

          {/* Centered Nav Links */}
          <div className="hidden md:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
            <Link href="/dashboard">
              <span className={`cursor-pointer transition-all duration-300 text-sm font-medium px-6 py-2.5 rounded-xl relative overflow-hidden group ${
                router.pathname === '/dashboard' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
              }`}>
                <span className="relative z-10">Dashboard</span>
                {router.pathname !== '/dashboard' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </span>
            </Link>
            <Link href="/market">
              <span className={`cursor-pointer transition-all duration-300 text-sm font-medium px-6 py-2.5 rounded-xl relative overflow-hidden group ${
                router.pathname === '/market' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
              }`}>
                <span className="relative z-10">Markets</span>
                {router.pathname !== '/market' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </span>
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Network Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-300 font-medium">
                {chainId === '0xa475' || parseInt(chainId, 16) === 42101 ? 'Push Chain' : 'Ethereum'}
              </span>
            </div>
            
            {/* Wallet Button - Pink theme */}
            <div className="relative push-wallet-button">
              <style jsx global>{`
                .push-wallet-button button {
                  background: linear-gradient(135deg, #ec4899 0%, #db2777 100%) !important;
                  border: 1px solid rgba(236, 72, 153, 0.3) !important;
                  transition: all 0.3s ease !important;
                  box-shadow: 0 4px 6px rgba(236, 72, 153, 0.1) !important;
                }
                .push-wallet-button button:hover {
                  background: linear-gradient(135deg, #db2777 0%, #be185d 100%) !important;
                  box-shadow: 0 0 20px rgba(236, 72, 153, 0.4) !important;
                  transform: translateY(-1px) !important;
                }
              `}</style>
              <PushUniversalAccountButton />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-black bg-[#0B0E14]/98 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-1 px-4 py-3">
          <Link href="/dashboard">
            <span className={`cursor-pointer transition-all duration-300 text-sm font-medium px-4 py-2 rounded-lg ${
              router.pathname === '/dashboard' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}>
              Dashboard
            </span>
          </Link>
          <Link href="/market">
            <span className={`cursor-pointer transition-all duration-300 text-sm font-medium px-4 py-2 rounded-lg ${
              router.pathname === '/market' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}>
              Markets
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

