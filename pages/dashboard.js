import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWeb3 } from '../components/providers/web3';
import { useAccount, useSupplyAssets, useYourSupplies, useYourBorrows } from '../components/hooks/web3';
import ModernNavbar from '../components/ui/ModernNavbar';
import PortfolioChart from '../components/ui/PortfolioChart';
import MockTokens from '../abis/MockTokens.json';
import { trackPromise } from 'react-promise-tracker';

export default function Faucet() {
  const router = useRouter();
  const { requireInstall, isLoading, connect, contract, web3, isUniversal, chainId, connectedAccount, pushChainContext } = useWeb3();
  const { account } = useAccount();
  const { yourSupplies } = useYourSupplies();
  const { yourBorrows } = useYourBorrows();
  const [claimStatus, setClaimStatus] = useState({});
  const [txHash, setTxHash] = useState({});
  const [lastClaimTime, setLastClaimTime] = useState({});
  const [forceUpdate, setForceUpdate] = useState(0); // Force remount counter

  // FORCE COMPONENT REMOUNT when web3 becomes ready
  useEffect(() => {
    if (web3 && contract && !isLoading && forceUpdate === 0) {
      console.log('🔄 Web3 ready - forcing component update to remount hooks');
      setTimeout(() => {
        setForceUpdate(1); // Trigger re-render which will remount hooks with web3 ready
      }, 200);
    }
  }, [web3, contract, isLoading, forceUpdate]);

  // Load claim times from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedClaimTimes = localStorage.getItem('faucetClaimTimes');
      if (storedClaimTimes) {
        setLastClaimTime(JSON.parse(storedClaimTimes));
      }
    }
  }, []);

  // Calculate portfolio metrics (using same structure as market.js)
  const totalSupplied = yourSupplies.data?.yourBalance || 0;
  const totalBorrowed = yourBorrows.data?.yourBalance || 0;
  const netWorth = totalSupplied - totalBorrowed;
  
  // Calculate borrowing capacity (80% LTV - Loan to Value ratio)
  const LTV_RATIO = 0.8; // 80% of collateral can be borrowed
  const maxBorrowCapacity = totalSupplied * LTV_RATIO;
  const availableToBorrow = Math.max(0, maxBorrowCapacity - totalBorrowed);

  // Calculate Health Score (similar to Aave)
  const calculateHealthScore = () => {
    if (!yourSupplies.data || !yourBorrows.data) return null;
    
    if (totalBorrowed === 0) return 100; // Perfect health if no borrows
    if (totalSupplied === 0) return 0; // Critical if borrowing with no collateral
    
    // Health Factor = (Total Collateral × Liquidation Threshold) / Total Borrows
    // Simplified: (Supply / Borrow) * 100
    const healthFactor = (totalSupplied / totalBorrowed) * 100;
    return Math.min(Math.max(healthFactor, 0), 100);
  };

  const healthScore = calculateHealthScore();

  // Get health status styling based on score
  const getHealthStatus = (score) => {
    if (score === null) return { color: 'text-white', bg: 'bg-gray-500', label: 'No Activity', ring: 'ring-gray-500' };
    if (score >= 80) return { color: 'text-white', bg: 'bg-green-500', label: 'Healthy', ring: 'ring-green-500' };
    if (score >= 50) return { color: 'text-white', bg: 'bg-yellow-500', label: 'Moderate', ring: 'ring-yellow-500' };
    if (score >= 25) return { color: 'text-white', bg: 'bg-orange-500', label: 'At Risk', ring: 'ring-orange-500' };
    return { color: 'text-white', bg: 'bg-red-500', label: 'Critical', ring: 'ring-red-500' };
  };

  const healthStatus = getHealthStatus(healthScore);

  // Tokens for faucet (Push Chain addresses)
  const tokens = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      amount: '1000',
      address: '0x9AF3c26641F51765d438F9B4914639CB9c4a8653',
      image: '/usdc.png'
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      amount: '10',
      address: '0xe9f78B65A69185740e376F644abf817B839bA45c',
      image: '/ethereum.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      amount: '1000',
      address: '0xc70343667d292c3393491c4008e1bDd7cfe0D495',
      image: '/usdtt.png'
    }
  ];

  const sendTransaction = async (method, fromAddress) => {
    const isPushChain = chainId === '0xa475' || parseInt(chainId, 16) === 42101;
    
    if (isPushChain) {
      const data = method.encodeABI();
      
      // Use MetaMask for Push Chain
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: fromAddress,
          to: method._parent._address,
          data: data,
          gas: '0x76c0'
        }],
      });
      
      const metamaskWeb3 = new web3.constructor(window.ethereum);
      const receipt = await metamaskWeb3.eth.getTransactionReceipt(txHash);
      return { transactionHash: txHash, ...receipt };
    }
    
    if (isUniversal && pushChainContext?.pushClient) {
      const data = method.encodeABI();
      return await pushChainContext.pushClient.universal.sendTransaction({
        to: method._parent._address,
        data: data,
        value: BigInt(0),
        gasLimit: BigInt(500000),
      });
    }
    
    return await method.send({ from: fromAddress });
  };

  const claimFaucet = async (token) => {
    const fromAddress = connectedAccount || account.data?.address;
    if (!fromAddress) {
      alert('Please connect your wallet first!');
      return;
    }

    // Check cooldown
    const now = Date.now();
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
    const lastClaim = lastClaimTime[token.symbol];
    
    if (lastClaim && (now - lastClaim) < cooldownPeriod) {
      const remainingTime = cooldownPeriod - (now - lastClaim);
      const hoursLeft = Math.floor(remainingTime / (60 * 60 * 1000));
      const minutesLeft = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
      
      alert(`Please wait ${hoursLeft}h ${minutesLeft}m before claiming ${token.symbol} again.`);
      return;
    }

    setClaimStatus({ ...claimStatus, [token.symbol]: 'loading' });
    setTxHash({ ...txHash, [token.symbol]: null });

    try {
      const tokenContract = new web3.eth.Contract(MockTokens, token.address);
      
      const result = await trackPromise(
        sendTransaction(
          tokenContract.methods.faucet(),
          fromAddress
        )
      );

      setClaimStatus({ ...claimStatus, [token.symbol]: 'success' });
      setTxHash({ ...txHash, [token.symbol]: result.transactionHash });

      // Update claim time
      const newClaimTimes = { ...lastClaimTime, [token.symbol]: Date.now() };
      setLastClaimTime(newClaimTimes);
      localStorage.setItem('faucetClaimTimes', JSON.stringify(newClaimTimes));

      // Reset status after 5 seconds
      setTimeout(() => {
        setClaimStatus({ ...claimStatus, [token.symbol]: null });
        setTxHash({ ...txHash, [token.symbol]: null });
      }, 5000);
    } catch (error) {
      console.error('Claim error:', error);
      setClaimStatus({ ...claimStatus, [token.symbol]: 'error' });
      setTimeout(() => {
        setClaimStatus({ ...claimStatus, [token.symbol]: null });
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14]">
      <Head>
        <title>Testnet Faucet - DeLend</title>
      </Head>

      <ModernNavbar />

      {!isLoading ? (
        web3 ? (
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
            
            {/* Professional Header */}
            <div className="mb-20">
              <div className="mb-16 text-center">
                 <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
                   Portfolio
                 </h1>
                 <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                   Manage your lending and borrowing positions
                 </p>
               </div>

              {/* Professional Account Overview */}
              {connectedAccount || account.data ? (
                <div className="space-y-6">
                  {/* Health Score Card */}
                  <div className="relative bg-gradient-to-br from-[#1A1F26] via-[#151A21] to-[#0F1419] border border-white/15 rounded-3xl p-12 transition-all duration-700 shadow-2xl shadow-black/40 hover:shadow-black/60 group overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
                              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-white tracking-tight">Health Factor</h2>
                          </div>
                          <p className="text-gray-300 text-lg">Your account's liquidation risk assessment</p>
                        </div>
                        <div className={`px-6 py-3 rounded-2xl text-base font-bold ${healthStatus.bg} ${healthStatus.color} ring-2 ${healthStatus.ring} shadow-xl backdrop-blur-sm`}>
                          {healthStatus.label}
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-16">
                      {/* Health Score Visualization */}
                      <div className="relative">
                        <div className="relative w-40 h-40">
                          {/* Outer glow effect */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-xl opacity-50"></div>

                          <svg className="relative w-full h-full transform -rotate-90 drop-shadow-2xl">
                            <defs>
                              <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#3B82F6" />
                                <stop offset="50%" stopColor="#8B5CF6" />
                                <stop offset="100%" stopColor="#06B6D4" />
                              </linearGradient>
                            </defs>
                            <circle
                              cx="80"
                              cy="80"
                              r="70"
                              stroke="#374151"
                              strokeWidth="8"
                              fill="none"
                              opacity="0.3"
                            />
                            <circle
                              cx="80"
                              cy="80"
                              r="70"
                              stroke="url(#healthGradient)"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 70}`}
                              strokeDashoffset={`${2 * Math.PI * 70 * (1 - (healthScore || 0) / 100)}`}
                              strokeLinecap="round"
                              style={{
                                transition: 'stroke-dashoffset 1s ease-in-out',
                                filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))'
                              }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-4xl font-bold text-white mb-2 tracking-tight">
                                {healthScore !== null ? healthScore.toFixed(0) : '--'}
                              </div>
                              <div className="text-sm text-gray-300 font-semibold tracking-widest">SCORE</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Health Description */}
                      <div className="flex-1">
                        <div className="text-sm text-gray-300 mb-2">
                          {healthScore === null
                            ? "Connect your wallet and start supplying assets to see your health factor."
                            : healthScore >= 80
                            ? "Your account is in excellent health with low liquidation risk."
                            : healthScore >= 50
                            ? "Your account health is moderate. Consider managing your positions."
                            : healthScore >= 25
                            ? "Your account is at risk. Consider reducing borrowed amounts or adding collateral."
                            : "Critical health level! Immediate action required to avoid liquidation."
                          }
                        </div>
                        <div className="text-xs text-gray-500">
                          Health Factor = (Total Collateral × LTV) / Total Debt
                        </div>
                      </div>
                    </div>

                    {/* Portfolio Metrics Grid - Integrated inside Health Box */}
                    <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
                       {/* Net Worth */}
                       <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
                         <div className="text-sm font-medium text-gray-400 mb-2">NET WORTH</div>
                         <div className="text-2xl font-bold text-white mb-1">${netWorth.toFixed(2)}</div>
                         <div className="text-xs text-gray-500">+2.5% from last week</div>
                       </div>

                       {/* Supplied */}
                       <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
                         <div className="text-sm font-medium text-gray-400 mb-2">SUPPLIED</div>
                         <div className="text-2xl font-bold text-white mb-1">${totalSupplied.toFixed(2)}</div>
                         <div className="text-xs text-gray-500">Earning interest</div>
                       </div>

                       {/* Borrowed */}
                       <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
                         <div className="text-sm font-medium text-gray-400 mb-2">BORROWED</div>
                         <div className="text-2xl font-bold text-white mb-1">${totalBorrowed.toFixed(2)}</div>
                         <div className="text-xs text-gray-500">Accruing interest</div>
                       </div>

                       {/* Available */}
                       <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
                         <div className="text-sm font-medium text-gray-400 mb-2">AVAILABLE</div>
                         <div className="text-2xl font-bold text-white mb-1">${availableToBorrow.toFixed(2)}</div>
                         <div className="text-xs text-gray-500">To borrow</div>
                       </div>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
                  <p className="text-blue-300">
                    Connect your wallet to view your portfolio health and metrics
                  </p>
                </div>
              )}
            </div>

            {/* Portfolio Charts */}
            {connectedAccount && (
              <div className="mt-16">
                <h2 className="text-3xl font-bold text-white mb-8 text-center">Statistics</h2>
                <PortfolioChart yourSupplies={yourSupplies} yourBorrows={yourBorrows} />
              </div>
            )}

            {/* Token Faucet */}
             <div className="mt-16">
               <div className="mb-8 text-center">
                 <h2 className="text-3xl font-bold text-white mb-2">
                   Token Faucet
                 </h2>
                 <p className="text-gray-400">
                   Claim test tokens for DeFi operations
                 </p>
               </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tokens.map((token, index) => (
                  <div key={index} className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative">
                        <img 
                          src={token.image} 
                          alt={token.symbol}
                          className="w-10 h-10 rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-white font-bold hidden">
                          {token.symbol[0]}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">{token.symbol}</h3>
                        <p className="text-gray-400 text-sm">{token.name}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 text-sm">Claim Amount</span>
                        <span className="text-white text-lg font-bold">{token.amount} {token.symbol}</span>
                      </div>
                    </div>

                    {(() => {
                      const now = Date.now();
                      const cooldownPeriod = 24 * 60 * 60 * 1000;
                      const lastClaim = lastClaimTime[token.symbol];
                      const isInCooldown = lastClaim && (now - lastClaim) < cooldownPeriod;
                      
                      return (
                        <button
                          onClick={() => claimFaucet(token)}
                          disabled={claimStatus[token.symbol] === 'loading' || claimStatus[token.symbol] === 'success' || isInCooldown}
                          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                            claimStatus[token.symbol] === 'loading'
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : claimStatus[token.symbol] === 'success'
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : isInCooldown
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : claimStatus[token.symbol] === 'error'
                              ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                              : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                          }`}
                        >
                          {claimStatus[token.symbol] === 'loading' && (
                            <div className="flex items-center justify-center space-x-2">
                              <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin"></div>
                              <span>Claiming...</span>
                            </div>
                          )}
                          {claimStatus[token.symbol] === 'success' && (
                            <div className="flex items-center justify-center space-x-2">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>Claimed Successfully!</span>
                            </div>
                          )}
                          {isInCooldown && !claimStatus[token.symbol] && (
                            <div className="flex items-center justify-center space-x-2">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              <span>On Cooldown</span>
                            </div>
                          )}
                          {claimStatus[token.symbol] === 'error' && 'Try Again'}
                          {!claimStatus[token.symbol] && !isInCooldown && `Claim ${token.symbol}`}
                        </button>
                      );
                    })()}

                    {txHash[token.symbol] && (
                      <div className="mt-4 p-3 bg-gray-800 border border-gray-600 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <p className="text-green-400 text-sm font-medium">Transaction Confirmed</p>
                        </div>
                        <p className="text-gray-300 text-xs font-mono break-all bg-gray-700 p-2 rounded">
                          {txHash[token.symbol]}
                        </p>
                      </div>
                    )}

                    {(() => {
                      const now = Date.now();
                      const cooldownPeriod = 24 * 60 * 60 * 1000;
                      const lastClaim = lastClaimTime[token.symbol];
                      
                      if (lastClaim && (now - lastClaim) < cooldownPeriod) {
                        const remainingTime = cooldownPeriod - (now - lastClaim);
                        const hoursLeft = Math.floor(remainingTime / (60 * 60 * 1000));
                        const minutesLeft = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
                        
                        return (
                          <div className="mt-4 p-3 bg-gray-800 border border-gray-600 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                              <p className="text-yellow-400 text-sm font-medium">
                                Next claim available in {hoursLeft}h {minutesLeft}m
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()} 
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : requireInstall ? (
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Wallet Required</h2>
              <p className="text-gray-400 mb-6">Install a Web3 wallet to continue</p>
              <a
                href="https://metamask.io/download.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all"
              >
                Install MetaMask
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-6">Connect Wallet</h2>
              <button
                onClick={connect}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      )}
    </div>
  );
}

