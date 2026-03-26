"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUI } from "@/context/UIContext";

interface PostSweepModalProps {
  receivedUSDC: string;
  deadTokens: any[];
  sellTxHash?: string;
  burnTxHashes?: `0x${string}`[];
  onBurnDead: () => void;
  onClose: () => void;
  isBurning: boolean;
}

export function PostSweepModal({
  receivedUSDC,
  deadTokens,
  sellTxHash,
  burnTxHashes,
  onBurnDead,
  onClose,
  isBurning,
}: PostSweepModalProps) {
  const { t, isArabic } = useUI();

  const allTxHashes = [
    ...(sellTxHash ? [sellTxHash] : []),
    ...(burnTxHashes ?? []),
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-bg-main/90 backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="v-glass w-full max-w-lg rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-[0_0_100px_rgba(0,82,255,0.2)]"
        >
          {/* Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full -mt-24" />
          
          <div className="relative z-10 text-center space-y-8">
            {/* Icon */}
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-4xl font-black font-heading text-text-primary tracking-tighter">
                {t.cleaningSuccess}
              </h2>
              {Number(receivedUSDC.replace(/[^0-9.]/g, "")) > 0 && (
                <p className="text-text-secondary font-semibold text-lg">
                  +{receivedUSDC} USDC {isArabic ? "استُلم" : "Received"}
                </p>
              )}
            </div>

            {/* Transaction Links */}
            {allTxHashes.length > 0 && (
              <div className="space-y-2">
                {sellTxHash && (
                  <a
                    href={`https://basescan.org/tx/${sellTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between w-full v-card p-4 hover:border-accent/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-500">💰</span>
                      <span className="text-[11px] font-black text-text-secondary uppercase tracking-widest">
                        {isArabic ? "معاملة البيع" : "Sell Transaction"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted group-hover:text-accent transition-colors">
                      {sellTxHash.slice(0, 6)}...{sellTxHash.slice(-4)} ↗
                    </span>
                  </a>
                )}
                {burnTxHashes && burnTxHashes.length > 0 && (
                  <div className="space-y-1">
                    {burnTxHashes.map((txHash, i) => (
                      <a
                        key={txHash}
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between w-full v-card p-4 hover:border-orange-500/30 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <span>🔥</span>
                          <span className="text-[11px] font-black text-text-secondary uppercase tracking-widest">
                            {isArabic ? `حرق #${i + 1}` : `Burn #${i + 1}`}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted group-hover:text-orange-400 transition-colors">
                          {txHash.slice(0, 6)}...{txHash.slice(-4)} ↗
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dead Tokens Action / Close */}
            <div className="grid grid-cols-1 gap-3">
              {deadTokens.length > 0 ? (
                <div className="v-card p-6 bg-bg-elevated/50 space-y-5">
                  <div className="space-y-2">
                    <p className="v-stat-label !text-orange-400 text-center">
                      {isArabic ? `${deadTokens.length} رمز بلا سيولة 🔥` : `${deadTokens.length} Tokens with No Liquidity 🔥`}
                    </p>
                    <p className="text-[11px] text-text-muted text-center font-bold">
                      {isArabic ? "حرقها مجاني تماماً. هل تريد تنظيف المحفظة بالكامل؟" : "Burning is free. Want a Zero-Dust wallet?"}
                    </p>
                  </div>
                  <button
                    onClick={onBurnDead}
                    disabled={isBurning}
                    className="w-full py-5 v-btn-primary !bg-orange-600 shadow-orange-600/20 disabled:opacity-50"
                  >
                    {isBurning ? (isArabic ? "جارٍ الحرق..." : "Burning...") : (isArabic ? "🔥 حرق الكل مجاناً" : "🔥 Burn All Free")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={onClose}
                  className="v-btn-primary w-full"
                >
                  {t.completed} ✨
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
