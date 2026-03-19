"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";
import { type SweepState } from "@/hooks/useSweep";

interface SweepPanelProps {
  selectedTokens: any[];
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
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
          {/* Selected Stats */}
          <div className="v-card bg-bg-main/80 p-6 space-y-4">
            <div className="flex justify-between items-end border-b border-divider pb-4">
              <span className="v-stat-label">{isArabic ? "الأصل المختارة" : "Assets"}</span>
              <span className="v-stat-value !text-xl">{selectedTokens.length}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="v-stat-label">{isArabic ? "القيمة المتوقعة" : "Est. Value"}</span>
              <span className="v-stat-value !text-xl text-emerald-500">${totalSelectedUSD.toFixed(2)}</span>
            </div>
          </div>

          {/* Slippage Settings */}
          <div className="v-card p-6 space-y-5">
            <div className="flex justify-between items-center mb-1">
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
            {sweepState.status === "classifying" && (
              <div className="v-card p-6 bg-accent/5 border-accent/20 flex flex-col items-center gap-4 text-center">
                <div className="w-8 h-8 border-4 border-accent/10 border-t-accent rounded-full animate-spin" />
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-accent uppercase tracking-widest">{t.analyzing}</p>
                  <p className="text-[9px] font-bold text-text-muted opacity-70">{sweepState.currentStep}</p>
                </div>
              </div>
            )}

            {sweepState.sweepResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="v-card p-6 border-emerald-500/20 bg-emerald-500/[0.03] space-y-5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse" />
                  <span className="v-stat-label !text-emerald-500">{t.readyToSell}</span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-divider pb-4">
                    <span className="v-stat-label">{t.receive}</span>
                    <span className="v-stat-value !text-2xl text-emerald-500">{sweepState.formattedUserReceives} USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="v-stat-label !text-[9px]">{t.marketVia}</span>
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-80">0x + Aerodrome + Uni V3</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={onExecute}
                disabled={sweepState.status === "classifying" || ["approving", "selling", "burning"].includes(sweepState.status)}
                className={`v-btn-primary w-full group overflow-hidden ${
                  ["approving", "selling", "burning"].includes(sweepState.status) ? "opacity-70" : ""
                }`}
              >
                <span className="relative z-10 flex items-center gap-3">
                  {["approving", "selling", "burning"].includes(sweepState.status) ? (
                    <>
                      <div className="w-5 h-5 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                      {sweepState.currentStep || t.selling}
                    </>
                  ) : sweepState.sweepResult ? (
                    <>
                      {t.confirmSell}
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
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

              {(sweepState.sweepResult || sweepState.status === "error") && (
                <button
                  onClick={onReset}
                  className="v-btn-secondary w-full"
                >
                  {t.retry}
                </button>
              )}
            </div>

            {sweepState.status === "error" && (
              <p className="text-[10px] font-black text-rose-500 text-center uppercase tracking-widest bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                {sweepState.error}
              </p>
            )}

            {/* Platform Trust */}
            <div className="pt-4 flex items-center justify-center gap-6 opacity-40">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xl">🛡️</span>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Atomic</span>
              </div>
              <div className="w-[1px] h-4 bg-divider" />
              <div className="flex flex-col items-center gap-2">
                <span className="text-xl">💧</span>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Liquidity</span>
              </div>
              <div className="w-[1px] h-4 bg-divider" />
              <div className="flex flex-col items-center gap-2">
                <span className="text-xl">⚡</span>
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Instant</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
