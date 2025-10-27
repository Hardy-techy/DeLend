import { useState } from 'react';

export default function BorrowModal({ token, onClose, onBorrow, onRefresh, txResult, txError, userBorrowCapacity }) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Use user's borrow capacity if provided, otherwise fall back to pool liquidity
  const maxBorrowAmount = userBorrowCapacity !== undefined ? userBorrowCapacity : parseFloat(token.availableAmountInContract?.amount || 0);

  const handleBorrow = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setIsLoading(true);
    try {
      await onBorrow(token, amount);
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    setAmount(maxBorrowAmount.toString());
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-md w-full border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Borrow {token.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {!txResult && !txError ? (
            <>
              {/* Token Info */}
              <div className="flex items-center gap-3 mb-6">
                <img src={token.image?.src} alt={token.name} className="w-12 h-12 rounded-full" />
                <div>
                  <p className="text-white font-medium">{token.name}</p>
                  <p className="text-sm text-gray-400">${token.oneTokenToDollar?.toFixed(2)}</p>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">Amount</label>
                  <span className="text-sm text-gray-400">
                    You can borrow: {maxBorrowAmount.toFixed(4)}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    max={maxBorrowAmount}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-purple-500 transition"
                  />
                  <button
                    onClick={setMaxAmount}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition"
                  >
                    MAX
                  </button>
                </div>
                {amount && (
                  <p className="text-sm text-gray-400 mt-2">
                    ≈ ${(parseFloat(amount) * token.oneTokenToDollar).toFixed(2)}
                  </p>
                )}
                {maxBorrowAmount === 0 && (
                  <p className="text-yellow-400 text-sm mt-2">
                    ⚠️ You need to supply collateral first to borrow
                  </p>
                )}
              </div>

              {/* Borrow Stats */}
              <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Borrow APY</span>
                  <span className="text-red-400 font-medium">
                    {(parseFloat(token.borrowAPYRate || 0) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">LTV</span>
                  <span className="text-white">{(parseFloat(token.LTV || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Borrow Button */}
              <button
                onClick={handleBorrow}
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxBorrowAmount || isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : parseFloat(amount) > maxBorrowAmount ? (
                  'Insufficient Borrow Capacity'
                ) : (
                  'Borrow'
                )}
              </button>
            </>
          ) : txResult ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Borrow Successful!</h3>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
                <p className="text-purple-400 font-bold text-xl">{amount} {token.name}</p>
                <p className="text-gray-400 text-sm mt-1">
                  ≈ ${(parseFloat(amount) * token.oneTokenToDollar).toFixed(2)}
                </p>
              </div>
              <p className="text-gray-400 mb-4">Tokens borrowed successfully</p>
              <a
                href={`https://donut.push.network/tx/${txResult.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline block mb-4"
              >
                View on Explorer
              </a>
              <button
                onClick={() => onClose()}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-bold transition"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Transaction Failed</h3>
              <p className="text-gray-400 text-sm">{txError?.message || 'Unknown error'}</p>
              <button
                onClick={onClose}
                className="mt-4 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

