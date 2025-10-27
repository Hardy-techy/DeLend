import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSWRConfig } from 'swr';
import { useWeb3 } from '../components/providers/web3';
import {
  useAccount,
  useBorrowAssets,
  useSupplyAssets,
  useYourBorrows,
  useYourSupplies,
} from '../components/hooks/web3';
import ModernNavbar from '../components/ui/ModernNavbar';
import SupplyModal from '../components/ui/SupplyModal';
import BorrowModal from '../components/ui/BorrowModal';
import WithdrawModal from '../components/ui/WithdrawModal';
import RepayModal from '../components/ui/RepayModal';
import TableSkeleton from '../components/ui/TableSkeleton';
import MockTokens from '../abis/MockTokens.json';
import { trackPromise } from 'react-promise-tracker';

export default function Home() {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig(); // Global SWR cache control
  const { requireInstall, isLoading, connect, contract, web3, isUniversal, chainId, connectedAccount, pushChainContext } = useWeb3();
  const { account } = useAccount();
  const { tokens, mutate: refreshSupplyAssets, isValidating: isLoadingSupply } = useSupplyAssets();
  const { tokensForBorrow, mutate: refreshBorrowAssets, isValidating: isLoadingBorrow } = useBorrowAssets();
  const { yourSupplies, mutate: refreshYourSupplies, isValidating: isLoadingYourSupplies } = useYourSupplies();
  const { yourBorrows, mutate: refreshYourBorrows, isValidating: isLoadingYourBorrows } = useYourBorrows();
  
  // Market page - no redirect needed
  
  // Check if any data is being refreshed
  const isRefreshing = isLoadingSupply || isLoadingBorrow || isLoadingYourSupplies || isLoadingYourBorrows;

  const [refreshKey, setRefreshKey] = useState(0); // Force re-render counter
  const [selectedToken, setSelectedToken] = useState(null);
  const [modalType, setModalType] = useState(null); // 'supply', 'withdraw', 'borrow', 'repay'
  const [showYourSupplies, setShowYourSupplies] = useState(true);
  const [showYourBorrows, setShowYourBorrows] = useState(true);
  const [showAssetsToSupply, setShowAssetsToSupply] = useState(true);
  const [showAssetsToBorrow, setShowAssetsToBorrow] = useState(true);

  const [txResult, setTxResult] = useState(null);
  const [txError, setTxError] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0); // Force remount counter

  const toWei = (value) => web3.utils.toWei(value.toString());

  // FORCE COMPONENT REMOUNT when web3 becomes ready
  useEffect(() => {
    if (web3 && contract && !isLoading && forceUpdate === 0) {
      console.log('� Web3 ready - forcing component update to remount hooks');
      setTimeout(() => {
        setForceUpdate(1); // Trigger re-render which will remount hooks with web3 ready
      }, 200);
    }
  }, [web3, contract, isLoading, forceUpdate]);

  // Function to refresh all data - Properly trigger SWR revalidation
  const refreshAllData = async () => {
    // Close modal first for a cleaner experience
    setModalType(null);
    setSelectedToken(null);
    setTxResult(null);
    setTxError(null);
    
    // Small delay to let modal close animation finish
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // FORCE refresh all data - Call mutate() with no arguments to trigger revalidation
    // This will refetch data from blockchain and update the cache
    try {
      await Promise.all([
        refreshSupplyAssets(),
        refreshBorrowAssets(), 
        refreshYourSupplies(),
        refreshYourBorrows()
      ]);
      console.log('✅ All data refreshed successfully');
    } catch (error) {
      console.error('❌ Refresh error:', error);
    }
  };

  // Send transaction helper - waits for confirmation on ALL paths
  const sendTransaction = async (method, fromAddress) => {
    const isPushChain = chainId === '0xa475' || parseInt(chainId, 16) === 42101;
    
    if (isPushChain) {
      const data = method.encodeABI();
      const to = method._parent._address;
      
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: fromAddress,
          to: to,
          data: data,
          gas: '0x7A120',
        }],
      });
      
      // Wait for transaction to be mined
      const metamaskWeb3 = new web3.constructor(window.ethereum);
      
      let receipt = null;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max
      
      while (!receipt && attempts < maxAttempts) {
        receipt = await metamaskWeb3.eth.getTransactionReceipt(txHash);
        if (!receipt) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }
      
      if (!receipt) {
        throw new Error('Transaction not mined after 60 seconds');
      }
      
      // Wait additional 2 seconds for blockchain state to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return { transactionHash: txHash, ...receipt };
    }
    
    if (isUniversal && pushChainContext?.pushClient) {
      const data = method.encodeABI();
      
      const result = await pushChainContext.pushClient.universal.sendTransaction({
        to: method._parent._address,
        data: data,
        value: BigInt(0),
        gasLimit: BigInt(500000),
      });
      
      // Wait for blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return result;
    }
    
    // Standard web3 send
    const receipt = await method.send({ from: fromAddress });
    
    // Wait for blockchain state to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return receipt;
  };

  const handleSupply = async (token, value) => {
    const fromAddress = connectedAccount || account.data;
    if (!fromAddress) throw new Error("No wallet connected");

    try {
      const tokenInst = new web3.eth.Contract(MockTokens, token.tokenAddress);
      
      // Approve
      await trackPromise(
        sendTransaction(
          tokenInst.methods.approve(contract.options.address, toWei(value)),
          fromAddress
        )
      );
      
      // Lend
      const result = await trackPromise(
        sendTransaction(
          contract.methods.lend(token.tokenAddress, toWei(value)),
          fromAddress
        )
      );
      
      setTxResult(result);
      
      // Immediately refresh data - transaction is already mined at this point
      await refreshAllData();
    } catch (err) {
      setTxError(err);
    }
  };

  const handleBorrow = async (token, value) => {
    const fromAddress = connectedAccount || account.data;
    if (!fromAddress) throw new Error("No wallet connected");

    try {
      const result = await trackPromise(
        sendTransaction(
          contract.methods.borrow(toWei(value), token.tokenAddress),
          fromAddress
        )
      );
      setTxResult(result);
      
      // Immediately refresh data - transaction is already mined at this point
      await refreshAllData();
    } catch (err) {
      setTxError(err);
    }
  };

  const handleWithdraw = async (token, value) => {
    const fromAddress = connectedAccount || account.data;
    if (!fromAddress) throw new Error("No wallet connected");

    try {
      const result = await trackPromise(
        sendTransaction(
          contract.methods.withdraw(token.tokenAddress, toWei(value)),
          fromAddress
        )
      );
      setTxResult(result);
      
      // Immediately refresh data - transaction is already mined at this point
      await refreshAllData();
    } catch (err) {
      setTxError(err);
    }
  };

  const handleRepay = async (token, value) => {
    const fromAddress = connectedAccount || account.data;
    if (!fromAddress) throw new Error("No wallet connected");

    try {
      const tokenInst = new web3.eth.Contract(MockTokens, token.tokenAddress);
      const interest = Number(token.borrowAPYRate) * Number(toWei(value));
      const amountToPayBack = (Number(toWei(value)) + interest).toString();
      
      // Approve
      await trackPromise(
        sendTransaction(
          tokenInst.methods.approve(contract.options.address, toWei(amountToPayBack)),
          fromAddress
        )
      );
      
      // Pay debt
      const result = await trackPromise(
        sendTransaction(
          contract.methods.payDebt(token.tokenAddress, toWei(value)),
          fromAddress
        )
      );
      setTxResult(result);
      
      // Immediately refresh data - transaction is already mined at this point
      await refreshAllData();
    } catch (err) {
      setTxError(err);
    }
  };

  const openModal = (type, token) => {
    setModalType(type);
    setSelectedToken(token);
    setTxResult(null);
    setTxError(null);
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedToken(null);
    setTxResult(null);
    setTxError(null);
  };

  // Calculate totals
  const totalSupplied = yourSupplies.data?.yourBalance || 0;
  const totalBorrowed = yourBorrows.data?.yourBalance || 0;
  const netWorth = totalSupplied - totalBorrowed;
  
  // Calculate borrowing capacity (80% LTV - Loan to Value ratio)
  const LTV_RATIO = 0.8; // 80% of collateral can be borrowed
  const maxBorrowCapacity = totalSupplied * LTV_RATIO;
  const availableToBorrow = maxBorrowCapacity - totalBorrowed;
  
  // Calculate Net APY (simplified - you can enhance this with weighted average)
  const avgSupplyAPY = yourSupplies.data?.yourSupplies?.length > 0
    ? yourSupplies.data.yourSupplies.reduce((acc, t) => acc + parseFloat(t.borrowAPYRate || 0), 0) / yourSupplies.data.yourSupplies.length
    : 0;
  
  const avgBorrowAPY = yourBorrows.data?.yourBorrows?.length > 0
    ? yourBorrows.data.yourBorrows.reduce((acc, t) => acc + parseFloat(t.borrowAPYRate || 0), 0) / yourBorrows.data.yourBorrows.length
    : 0;

  return (
    <div className="min-h-screen bg-[#0F1419]">
      <Head>
        <title>DeLend - Decentralized Lending Protocol</title>
      </Head>

      <ModernNavbar />

      {/* Show page IMMEDIATELY - don't wait for Web3! */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            
            {/* Clean Market Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src="/Push.png" 
                      alt="DeLend" 
                      className="w-8 h-8 rounded-lg"
                    />
                    <h1 className="text-2xl font-semibold text-white">Push Market</h1>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>v3</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Net worth</div>
                    <div className="text-lg font-medium text-white">${(totalSupplied - totalBorrowed).toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Net APY</div>
                    <div className="text-lg font-medium text-green-400">0.06%</div>
                  </div>
                </div>
              </div>

              {/* Connection Alert */}
              {!connectedAccount && !account.data && (
                <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-lg p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#2C2C2E] rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg mb-1">Connect your wallet</h3>
                      <p className="text-gray-400">
                        Connect your wallet to view your positions and start lending & borrowing assets
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 mb-1">Supported Wallets</div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-xs font-bold">M</span>
                        </div>
                        <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-xs font-bold">W</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Two Column Layout - Like Aave */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN - Your Positions */}
              <div className="space-y-6">
                {/* Your Supplies Section */}
                <div className="bg-[#1C1C1E] rounded-lg border border-[#2C2C2E] overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#2C2C2E] transition-colors"
                    onClick={() => setShowYourSupplies(!showYourSupplies)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-lg font-semibold text-white">Your supplies</h2>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Balance</div>
                          <div className="text-lg font-medium text-white">${totalSupplied.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400 mb-1">APY</div>
                          <div className="text-lg font-medium text-green-400">{(avgSupplyAPY * 100).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Collateral</div>
                          <div className="text-lg font-medium text-white">${totalSupplied.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors">
                      <svg className={`w-5 h-5 transition-transform ${showYourSupplies ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
            </div>

                  {showYourSupplies && (
                    <div className="border-t border-[#2C2C2E]">
                      {!yourSupplies.data ? (
                        <div className="px-6 py-4">
                          <TableSkeleton rows={2} />
                        </div>
                      ) : yourSupplies.data?.yourSupplies?.length > 0 ? (
                        <div className="w-full">
                          <table className="w-full table-fixed">
                            <thead>
                              <tr className="text-left border-b border-[#2C2C2E]">
                                <th className="px-4 py-3 text-gray-400 text-sm font-medium w-[30%]">Asset</th>
                                <th className="px-4 py-3 text-gray-400 text-sm font-medium w-[25%]">Balance</th>
                                <th className="px-4 py-3 text-gray-400 text-sm font-medium w-[15%]">APY</th>
                                <th className="px-4 py-3 text-gray-400 text-sm font-medium w-[30%]"></th>
                              </tr>
                            </thead>
                            <tbody>
                        {yourSupplies.data.yourSupplies.map((token) => (
                                <tr key={token.tokenAddress} className="border-b border-[#2C2C2E] hover:bg-[#2C2C2E] transition-colors">
                                  <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <img src={token.image?.src} alt={token.name} className="w-10 h-10 rounded-full ring-2 ring-white/10 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-white font-semibold text-base truncate">{token.name}</div>
                                  <div className="text-gray-400 text-xs">{token.symbol}</div>
                                </div>
                              </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div>
                                      <div className="text-white font-semibold text-base">{parseFloat(token.userTokenLentAmount.amount).toFixed(4)}</div>
                                      <div className="text-gray-400 text-xs">${parseFloat(token.userTokenLentAmount.inDollars).toFixed(2)}</div>
                            </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="text-green-400 font-semibold text-base">{(parseFloat(token.borrowAPYRate || 0) * 100).toFixed(2)}%</div>
                                  </td>
                                  <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openModal('supply', token)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex-1"
                              >
                                        Supply
                              </button>
                              <button
                                onClick={() => openModal('withdraw', token)}
                                        className="bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white px-3 py-1.5 rounded text-sm font-medium border border-[#2C2C2E] hover:border-[#3C3C3E] transition-colors flex-1"
                              >
                                Withdraw
                              </button>
                            </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                      ) : (
                        <div className="px-5 py-8 text-center text-gray-400">
                          Nothing supplied yet
                      </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Your Borrows Section */}
                <div className="bg-[#1C1C1E] rounded-lg border border-[#2C2C2E] overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#2C2C2E] transition-colors"
                    onClick={() => setShowYourBorrows(!showYourBorrows)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-lg font-semibold text-white">Your borrows</h2>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Balance</div>
                          <div className="text-lg font-medium text-white">${totalBorrowed.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400 mb-1">APY</div>
                          <div className="text-lg font-medium text-red-400">{(avgBorrowAPY * 100).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400 mb-1">Available</div>
                          <div className="text-lg font-medium text-white">${availableToBorrow.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors">
                      <svg className={`w-5 h-5 transition-transform ${showYourBorrows ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showYourBorrows && (
                    <div className="border-t border-white/10">
                      {!yourBorrows.data ? (
                        <div className="px-6 py-4">
                          <TableSkeleton rows={2} />
                        </div>
                      ) : yourBorrows.data?.yourBorrows?.length > 0 ? (
                        <div className="w-full">
                          <table className="w-full table-fixed">
                            <thead>
                              <tr className="text-left border-b border-white/10">
                                <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[25%]">Asset</th>
                                <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[20%]">Debt</th>
                                <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[12%]">APY</th>
                                <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[13%]">APY type</th>
                                <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[30%]"></th>
                              </tr>
                            </thead>
                            <tbody>
                        {yourBorrows.data.yourBorrows.map((token) => (
                                <tr key={token.tokenAddress} className="border-b border-white/5 hover:bg-[#22272E] transition-colors">
                                  <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <img src={token.image?.src} alt={token.name} className="w-10 h-10 rounded-full ring-2 ring-white/10 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-white font-semibold text-base truncate">{token.name}</div>
                                  <div className="text-gray-400 text-xs">{token.symbol}</div>
                                </div>
                              </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div>
                                      <div className="text-white font-semibold text-base">{parseFloat(token.userTokenBorrowedAmount.amount).toFixed(4)}</div>
                                      <div className="text-gray-400 text-xs">${parseFloat(token.userTokenBorrowedAmount.inDollars).toFixed(2)}</div>
                            </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="text-red-400 font-semibold text-base">{(parseFloat(token.borrowAPYRate || 0) * 100).toFixed(2)}%</div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className="text-gray-400 text-sm">Variable</span>
                                  </td>
                                  <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openModal('repay', token)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex-1"
                              >
                                Repay
                              </button>
                              <button
                                onClick={() => openModal('borrow', token)}
                                className="bg-[#2C2C2E] hover:bg-[#3C3C3E] text-white px-3 py-1.5 rounded text-sm font-medium border border-[#2C2C2E] hover:border-[#3C3C3E] transition-colors flex-1"
                              >
                                Borrow
                              </button>
                            </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                      ) : (
                        <div className="px-5 py-8 text-center text-gray-400">
                          Nothing borrowed yet
                      </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN - Available Assets */}
              <div className="space-y-6">
                {/* Assets to Borrow Section */}
                <div className="bg-[#1C1C1E] rounded-lg border border-[#2C2C2E] overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#2C2C2E] transition-colors"
                    onClick={() => setShowAssetsToBorrow(!showAssetsToBorrow)}
                  >
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-white">Assets to borrow</h2>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors">
                      <svg className={`w-5 h-5 transition-transform ${showAssetsToBorrow ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                  </button>
                  </div>

                  {showAssetsToBorrow && (
                    <div className="border-t border-white/10">
                      {!tokensForBorrow.data ? (
                        <div className="px-6 py-4">
                          <TableSkeleton rows={3} />
                        </div>
                      ) : (
                      <div className="w-full">
                        <table className="w-full table-fixed">
                          <thead>
                            <tr className="text-left border-b border-white/10">
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[28%]">Asset</th>
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[25%]">
                                Available
                              </th>
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[15%]">APY</th>
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[32%]"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {tokensForBorrow.data?.map((token) => {
                              // Calculate how much of this token user can borrow
                              const tokenPriceInDollars = parseFloat(token.oneTokenToDollar || 0);
                              const userCanBorrowInDollars = Math.max(0, availableToBorrow);
                              const userCanBorrowInTokens = tokenPriceInDollars > 0 ? userCanBorrowInDollars / tokenPriceInDollars : 0;
                              
                              // Also check protocol has enough liquidity
                              const protocolAvailable = parseFloat(token.availableAmountInContract.amount);
                              const actualAvailableToBorrow = Math.min(userCanBorrowInTokens, protocolAvailable);
                              const actualAvailableInDollars = actualAvailableToBorrow * tokenPriceInDollars;
                              
                              return (
                                <tr key={token.tokenAddress} className="border-b border-white/5 hover:bg-[#22272E] transition-colors">
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                      <img src={token.image?.src} alt={token.name} className="w-10 h-10 rounded-full ring-2 ring-white/10 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <div className="text-white font-semibold text-base truncate">{token.name}</div>
                                        <div className="text-gray-400 text-xs">{token.symbol}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div>
                                      <div className="text-white font-semibold text-base">{actualAvailableToBorrow.toFixed(2)}</div>
                                      <div className="text-gray-400 text-xs">${actualAvailableInDollars.toFixed(2)}</div>
                                      {totalSupplied === 0 && (
                                        <div className="text-yellow-400 text-xs mt-1">Supply first</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="text-red-400 font-semibold text-base">{(parseFloat(token.borrowAPYRate || 0) * 100).toFixed(2)}%</div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex justify-end">
                  <button
                                        onClick={() => openModal('borrow', token)}
                                        disabled={actualAvailableToBorrow <= 0}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  >
                    Borrow
                  </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Assets to Supply Section */}
                <div className="bg-[#1C1C1E] rounded-lg border border-[#2C2C2E] overflow-hidden">
                  <div 
                    className="flex items-center justify-between p-6 cursor-pointer hover:bg-[#2C2C2E] transition-colors"
                    onClick={() => setShowAssetsToSupply(!showAssetsToSupply)}
                  >
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-white">Assets to supply</h2>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors">
                      <svg className={`w-5 h-5 transition-transform ${showAssetsToSupply ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showAssetsToSupply && (
                    <div className="border-t border-white/10">
                      {!tokens.data ? (
                        <div className="px-6 py-4">
                          <TableSkeleton rows={3} />
                        </div>
                      ) : (
                      <div className="w-full">
                        <table className="w-full table-fixed">
                          <thead>
                            <tr className="text-left border-b border-white/10">
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[25%]">Assets</th>
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[20%]">Wallet balance</th>
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[12%]">APY</th>
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[13%] text-center">Collateral</th>
                              <th className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider w-[30%]"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {tokens.data?.map((token) => (
                              <tr key={token.tokenAddress} className="border-b border-white/5 hover:bg-[#22272E] transition-colors">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <img src={token.image?.src} alt={token.name} className="w-10 h-10 rounded-full ring-2 ring-white/10 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <div className="text-white font-semibold text-base truncate">{token.name}</div>
                                      <div className="text-gray-400 text-xs">{token.symbol}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div>
                                    <div className="text-white font-semibold text-base">{parseFloat(token.walletBalance.amount).toFixed(4)}</div>
                                    <div className="text-gray-400 text-xs">${parseFloat(token.walletBalance.inDollars).toFixed(2)}</div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-green-400 font-semibold text-base">{(parseFloat(token.borrowAPYRate || 0) * 100).toFixed(2)}%</div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className="text-green-400 text-xl">✓</span>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => openModal('supply', token)}
                                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors w-full"
                                    >
                                      Supply
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

      {/* Modals - only show when Web3 is ready */}
      {web3 && contract && modalType === 'supply' && selectedToken && (
        <SupplyModal
          token={selectedToken}
          onClose={closeModal}
          onSupply={handleSupply}
          onRefresh={refreshAllData}
          txResult={txResult}
          txError={txError}
        />
      )}
      {web3 && contract && modalType === 'borrow' && selectedToken && (() => {
        // Calculate user's borrow capacity for the selected token
        const tokenPriceInDollars = parseFloat(selectedToken.oneTokenToDollar || 0);
        const userCanBorrowInDollars = Math.max(0, availableToBorrow);
        const userCanBorrowInTokens = tokenPriceInDollars > 0 ? userCanBorrowInDollars / tokenPriceInDollars : 0;
        
        // Also check protocol has enough liquidity
        const protocolAvailable = parseFloat(selectedToken.availableAmountInContract.amount);
        const actualAvailableToBorrow = Math.min(userCanBorrowInTokens, protocolAvailable);
        
        return (
        <BorrowModal
          token={selectedToken}
          onClose={closeModal}
          onBorrow={handleBorrow}
            onRefresh={refreshAllData}
            userBorrowCapacity={actualAvailableToBorrow}
          txResult={txResult}
          txError={txError}
        />
        );
      })()}
      {web3 && contract && modalType === 'withdraw' && selectedToken && (
        <WithdrawModal
          token={selectedToken}
          onClose={closeModal}
          onWithdraw={handleWithdraw}
          onRefresh={refreshAllData}
          txResult={txResult}
          txError={txError}
        />
      )}
      {web3 && contract && modalType === 'repay' && selectedToken && (
        <RepayModal
          token={selectedToken}
          onClose={closeModal}
          onRepay={handleRepay}
          onRefresh={refreshAllData}
          txResult={txResult}
          txError={txError}
        />
      )}
    </div>
  );
}

