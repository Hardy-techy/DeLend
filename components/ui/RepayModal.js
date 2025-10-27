import { useState } from 'react';

export default function RepayModal({ token, onClose, onRepay, onRefresh, txResult, txError }) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRepay = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setIsLoading(true);
    try {
      await onRepay(token, amount);
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    setAmount(token.userTokenBorrowedAmount?.amount || '0');
  };

  const interest = parseFloat(amount || 0) * parseFloat(token.borrowAPYRate || 0);
  const totalToRepay = parseFloat(amount || 0) + interest;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-md w-full border border-white/20 shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Repay {token.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {!txResult && !txError ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <img src={token.image?.src} alt={token.name} className="w-12 h-12 rounded-full" />
                <div>
                  <p className="text-white font-medium">{token.name}</p>
                  <p className="text-sm text-gray-400">${token.oneTokenToDollar?.toFixed(2)}</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400">Amount</label>
                  <span className="text-sm text-gray-400">
                    Borrowed: {parseFloat(token.userTokenBorrowedAmount?.amount || 0).toFixed(4)}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-green-500 transition"
                  />
                  <button
                    onClick={setMaxAmount}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Repay Breakdown */}
              <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Principal</span>
                  <span className="text-white">{parseFloat(amount || 0).toFixed(4)} {token.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Interest</span>
                  <span className="text-yellow-400">{interest.toFixed(4)} {token.name}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-white font-medium">Total to Repay</span>
                  <span className="text-white font-bold">{totalToRepay.toFixed(4)} {token.name}</span>
                </div>
              </div>

              <button
                onClick={handleRepay}
                disabled={!amount || parseFloat(amount) <= 0 || isLoading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  'Repay'
                )}
              </button>
            </>
          ) : txResult ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Repayment Successful!</h3>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                <div className="space-y-2 mb-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Principal:</span>
                    <span className="text-white">{amount} {token.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Interest:</span>
                    <span className="text-yellow-400">{(parseFloat(amount) * parseFloat(token.borrowAPYRate || 0)).toFixed(4)} {token.name}</span>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-2">
                  <p className="text-green-400 font-bold text-xl">Total: {(parseFloat(amount) + parseFloat(amount) * parseFloat(token.borrowAPYRate || 0)).toFixed(4)} {token.name}</p>
                  <p className="text-gray-400 text-sm mt-1">
                    ≈ ${((parseFloat(amount) + parseFloat(amount) * parseFloat(token.borrowAPYRate || 0)) * token.oneTokenToDollar).toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-gray-400 mb-4">Debt repaid successfully</p>
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
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold transition"
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

