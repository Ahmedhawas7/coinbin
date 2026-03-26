// src/components/SweepPanel.tsx
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";
import { type SweepState } from "@/hooks/useSweep";
import { type ScannedToken } from "@/lib/scanner";

interface SweepPanelProps {
  selectedTokens: ScannedToken[];
  slippageBps: number;
  onSlippageChange: (val: number) => void;
  sweepState: SweepState;
  onExecute: () => void;
  onReset: () => void;
  isConnected: boolean;
}

export function SweepPanel({
  selectedTokens,
  slippageBps,
  onSlippageChange,
  sweepState,
  onExecute,
  onReset,
  isConnected,
}: SweepPanelProps) {
  const { t, isArabic } = useUI();

  const totalSelectedUSD = useMemo(
    () => selectedTokens.reduce((s, t) => s + t.usdValue, 0),
    [selectedTokens]
  );

  const sellCount = useMemo(() => 
    sweepState.swaps.filter(s => s.quote !== null).length, 
    [sweepState.swaps]
  );
  
  const burnCount = useMemo(() => 
    sweepState.swaps.filter(s => s.quote === null).length, 
    [sweepState.swaps]
  );

  const isActive = ["scanning", "preparing", "cleaning"].includes(sweepState.status);
  
  const progressPercent = useMemo(() => {
    if (sweepState.status === "scanning") return 20;
    if (sweepState.status === "preparing") return 40;
    if (sweepState.status === "cleaning" && sweepState.progress) {
      return 40 + (sweepState.progress.current / sweepState.progress.total) * 60;
    }
    if (sweepState.status === "success") return 100;
    return 0;
  }, [sweepState.status, sweepState.progress]);

  return (
    <div className="v-glass rounded-[2rem] p-8 md:p-10 flex flex-col gap-8 border-divider shadow-2xl sticky top-28">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="v-stat-label !text-accent font-heading">{isArabic ? "منصة التحكم ⚡" : "Control Center ⚡"}</h3>
        <p className="text-[11px] font-bold text-text-secondary leading-relaxed opacity-70">
          {isArabic ? "نظام المعالجة الذكي لشبكة Base لتصفية المحفظة بأمان." : "Base Protocol intelligence layer for automated wallet clearing."}
        </p>
      </div>

      {!isConnected ? (
        <div className="py-6 italic text-[11px] font-black uppercase tracking-widest text-text-muted opacity-50">
          Waiting for authorization...
        </div>
      ) : selectedTokens.length === 0 ? (
        <div className="v-card p-8 text-center bg-bg-main/50 border-dashed border-divider">
          <p className="text-3xl mb-4 opacity-30">📥</p>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-text-muted">{t.noTokens}</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">

          {/* Selected Stats */}
          <div className="v-card bg-bg-main/80 p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-divider pb-3">
              <span className="v-stat-label">{isArabic ? "الأصول المختارة" : "Assets Selected"}</span>
              <span className="v-stat-value !text-xl">{selectedTokens.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="v-stat-label">{isArabic ? "القيمة المتوقعة" : "Est. Value"}</span>
              <span className="v-stat-value !text-xl text-emerald-500">${totalSelectedUSD.toFixed(2)}</span>
            </div>

            {sweepState.swaps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex gap-3 pt-2 border-t border-divider"
              >
                <div className="flex-1 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  <span className="text-sm">💰</span>
                  <div>
                    <p className="text-[8.5px] font-black uppercase tracking-widest text-emerald-500">{isArabic ? "للبيع" : "To Sell"}</p>
                    <p className="text-base font-black text-emerald-500">{sellCount}</p>
                  </div>
                </div>
                {burnCount > 0 && (
                  <div className="flex-1 flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">
                    <span className="text-sm">🔥</span>
                    <div>
                      <p className="text-[8.5px] font-black uppercase tracking-widest text-orange-400">{isArabic ? "للحرق" : "To Burn"}</p>
                      <p className="text-base font-black text-orange-400">{burnCount}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Progress bar (visible during execution) */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-text-muted">
                <span className="text-accent">{sweepState.currentStep}</span>
                {sweepState.progress && (
                  <span>{sweepState.progress.current} / {sweepState.progress.total}</span>
                )}
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          )}

          {/* Slippage Settings */}
          <div className="v-card p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="v-stat-label">{t.slippage}</span>
              <span className="text-[11px] font-black font-mono text-accent">{(slippageBps / 100).toFixed(1)}%</span>
            </div>
            <div className="flex gap-2">
              {[10, 50, 100, 300].map((v) => (
                <button
                  key={v}
                  onClick={() => onSlippageChange(v)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${
                    slippageBps === v
                      ? "bg-accent text-white shadow-lg shadow-accent/20"
                      : "bg-bg-elevated text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {(v / 100).toFixed(1)}%
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Actions & Feedback */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <button
                onClick={onExecute}
                disabled={isActive}
                className={`v-btn-primary w-full group overflow-hidden ${isActive ? "opacity-70" : ""}`}
              >
                <span className="relative z-10 flex items-center gap-3">
                  {isActive ? (
                    <>
                      <div className="w-5 h-5 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                      {sweepState.currentStep}
                    </>
                  ) : sweepState.status === "success" ? (
                    <>
                      {isArabic ? "اكتمل بنجاح ✅" : "Success ✅"}
                    </>
                  ) : (
                    <>
                      {t.startCleaning}
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </button>

              {(sweepState.status === "success" || sweepState.status === "error") && (
                <button
                  onClick={onReset}
                  className="v-btn-secondary w-full"
                >
                  {t.retry}
                </button>
              )}
            </div>

            {sweepState.status === "error" && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                  {sweepState.error}
                </p>
                {sweepState.progress?.errors.map((err, i) => (
                   <p key={i} className="text-[9px] text-rose-400 opacity-80">{err}</p>
                ))}
              </div>
            )}

            {/* Platform Trust */}
            <div className="pt-2 flex items-center justify-center gap-6 opacity-40">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-lg">🛡️</span>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Atomic</span>
              </div>
              <div className="w-[1px] h-4 bg-divider" />
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-lg">💧</span>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Liquidity</span>
              </div>
              <div className="w-[1px] h-4 bg-divider" />
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-lg">⚡</span>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Instant</span>
              </div>
              <div className="w-[1px] h-4 bg-divider" />
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-lg">🔥</span>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Free Burn</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

