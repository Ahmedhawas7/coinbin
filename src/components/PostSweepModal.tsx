"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUI } from "@/context/UIContext";

interface PostSweepModalProps {
  receivedUSDC: string;
  deadTokens: any[];
  sellTxHash?: string;
  onBurnDead: () => void;
  onClose: () => void;
  isBurning: boolean;
}

export function PostSweepModal({
  receivedUSDC,
  deadTokens,
  sellTxHash,
  onBurnDead,
  onClose,
  isBurning,
}: PostSweepModalProps) {
  const { t, isArabic } = useUI();

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
          {/* Success Decoration */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full -mt-24" />
          
          <div className="relative z-10 text-center space-y-8">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl font-black font-heading text-text-primary tracking-tighter">
                {t.cleaningSuccess}
              </h2>
              <p className="text-text-secondary font-semibold text-lg">
                +{receivedUSDC} USDC Received
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {sellTxHash && (
                <a
                  href={`https://basescan.org/tx/${sellTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="v-btn-secondary !py-4 text-[11px]"
                >
                  🚀 {t.viewTx}
                </a>
              )}

              {deadTokens.length > 0 ? (
                <div className="v-card p-8 bg-bg-elevated/50 space-y-6 mt-4">
                  <div className="space-y-2 text-left">
                    <p className="v-stat-label !text-orange-500 text-center">Remaining Dead Assets 🔥</p>
                    <p className="text-[11px] text-text-muted text-center font-bold">
                      {deadTokens.length} tokens have no market value. Burn them to reach Zero-Dust?
                    </p>
                  </div>
                  <button
                    onClick={onBurnDead}
                    disabled={isBurning}
                    className="w-full py-5 v-btn-primary !bg-orange-600 shadow-orange-600/20"
                  >
                    {isBurning ? "Burning..." : "Finish: Burn Dead Tokens"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={onClose}
                  className="v-btn-primary w-full mt-4"
                >
                  {t.completed}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
