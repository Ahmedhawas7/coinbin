"use client";

import { useEffect, useCallback, useRef } from "react";
import { type SweepState } from "@/hooks/useSweep";
import { type TokenBalance } from "@/hooks/useTokenBalances";
import { formatUSDC, calcProtocolFeeUSD } from "@/lib/sweep";
import { PROTOCOL_FEE_BPS } from "@/config/contracts";
import { motion, AnimatePresence } from "framer-motion";
import { useUI } from "@/context/UIContext";

interface SweepPanelProps {
  selectedTokens: TokenBalance[];
  slippageBps: number;
  onSlippageChange: (bps: number) => void;
  sweepState: SweepState;
  onExecute: () => void;
  onReset: () => void;
  isConnected: boolean;
  onAutoClassify?: () => void;
}

const SLIPPAGE_OPTIONS = [
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
  { label: "2%", bps: 200 },
];

function StageBar({ status }: { status: SweepState["status"] }) {
  const { isArabic } = useUI();
  const stages = [
    { id: "classifying", label: isArabic ? "تحليل" : "Analyze" },
    { id: "approving",   label: isArabic ? "موافقة" : "Approve" },
    { id: "selling",     label: isArabic ? "بيع" : "Sell" },
    { id: "burning",     label: isArabic ? "حرق" : "Burn" },
    { id: "success",     label: isArabic ? "اكتمال" : "Done" },
  ];
  const order = ["classifying", "approving", "selling", "burning", "success"];
  const currentIdx = order.indexOf(status);

  return (
    <div className="flex items-center gap-1.5 my-5">
      {stages.map((s, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center gap-2">
            <div className={`h-1.5 w-full rounded-full transition-all duration-700 relative overflow-hidden ${
              done ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : active ? "bg-white/5" : "bg-white/[0.02]"
            }`}>
              {active && (
                <motion.div 
                  layoutId="active-stage"
                  className="absolute inset-0 bg-accent shadow-[0_0_20px_var(--accent-glow)]"
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>
            <span className={`text-[9px] md:text-[10px] font-black tracking-widest uppercase transition-colors duration-300 ${
              active ? "text-accent" : done ? "text-emerald-500" : "text-slate-600"
            }`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
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
  const { t, isArabic, isLight } = useUI();
  const { status, sweepResult, currentStep, sellTxHash, error,
          approvalsNeeded, approvalsComplete } = sweepState;
  const isProcessing = ["classifying", "approving", "selling", "burning"].includes(status);

  const totalUSD = selectedTokens.reduce((s, t) => s + t.usdValue, 0);
  const estimatedFeeUSD = calcProtocolFeeUSD(totalUSD);
  const estimatedUserUSD = totalUSD - estimatedFeeUSD;
  const feePercent = Number(PROTOCOL_FEE_BPS) / 100;

  function getButton() {
    if (!isConnected)         return { text: isArabic ? "ربط المحفظة للبدء" : "Connect Wallet to Start", disabled: true,  color: "gray" };
    if (status === "success") return { text: isArabic ? "تنظيف محفظة أخرى 🗑️" : "Sweep Another Wallet 🗑️", disabled: false, color: "green", isReset: true };
    if (status === "error")   return { text: isArabic ? "إعادة المحاولة" : "Retry Transaction", disabled: false, color: "red" };
    if (isProcessing)         return { text: currentStep || (isArabic ? "جارٍ المعالجة..." : "Processing..."), disabled: true,  color: "blue", loading: true };
    if (selectedTokens.length === 0)
                               return { text: isArabic ? "اختر رموزاً للبدء" : "Select Assets to Start", disabled: true,  color: "gray" };
    
    const sells = sweepResult?.sellQuotes.length ?? 0;
    const burns = sweepResult?.burnQuotes.length ?? 0;

    if (sells > 0 && burns > 0)
      return { text: isArabic ? `تنفيذ: بيع ${sells} + حرق ${burns}` : `Execute: Sell ${sells} + Burn ${burns}`, disabled: false, color: "blue" };
    if (sells > 0)
      return { text: isArabic ? `تأكيد البيع → USDC 💰` : `Confirm Sale → USDC 💰`, disabled: false, color: "blue" };
    if (burns > 0)
      return { text: isArabic ? `حرق ${burns} رموز ميتة 🔥` : `Burn ${burns} Inactive Icons 🔥`, disabled: false, color: "orange" };
    
    if (status === "classifying")
      return { text: isArabic ? "جارٍ فحص 0x + Aerodrome..." : "Scanning 0x + Aerodrome...", disabled: true, color: "blue", loading: true };
    
    return { text: isArabic ? `بدء التنظيف (${selectedTokens.length} رمز)` : `Start Sweep (${selectedTokens.length} items)`, disabled: false, color: "blue" };
  }

  const btn = getButton();

  const btnClass: string = {
    blue:   "btn-primary text-white",
    green:  "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20",
    red:    "bg-red-600 hover:bg-red-500 text-white",
    orange: "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/30",
    gray:   "bg-white/5 text-slate-600 cursor-not-allowed border border-white/5",
  }[btn.color] || "";

  const netReceive = sweepResult
    ? formatUSDC(sweepResult.totalAfterFee)
    : `~$${(estimatedUserUSD * (1 - slippageBps / 10000)).toFixed(2)}`;

  return (
    <div className="glass rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl sticky top-6">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-lg border border-accent/20">
            🗑️
          </div>
          <span className="text-xs font-black text-white uppercase tracking-widest">CoinBin Sweep</span>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-pulse" />
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">Live · Base</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Smart Wallet Capability Indicators */}
        {(sweepState.isBatchingSupported || sweepState.isPaymasterSupported) && !isProcessing && status !== "success" && (
          <div className="flex flex-wrap gap-2 px-1">
            {sweepState.isBatchingSupported && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest border-dashed">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 2v20M2 12h20"/></svg>
                Atomic Batching
              </div>
            )}
            {sweepState.isPaymasterSupported && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-[9px] font-black text-accent uppercase tracking-widest border-dashed">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Gas Sponsored
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {/* ─── Success ──────────────────────────────────────────────────── */}
            {status === "success" && (
              <motion.div 
                key="success"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="text-center py-4 space-y-4 group"
              >
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-4xl shadow-[0_0_40px_rgba(16,185,129,0.2)] border border-emerald-500/30 group-hover:scale-110 transition-transform duration-500">
                  ✅
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-black text-text-primary tracking-tight">{isArabic ? "تم التنظيف بنجاح!" : "Sweep Complete!"}</div>
                  <div className="text-sm text-text-secondary">
                    {t.receive} <span className="text-emerald-400 font-black">{sweepState.formattedUserReceives}</span> USDC
                  </div>
                </div>
                {sellTxHash && (
                  <a
                    href={`https://basescan.org/tx/${sellTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 text-[10px] text-accent hover:bg-accent/10 transition-all font-black uppercase tracking-widest"
                  >
                    {isArabic ? "عرض المعاملة ↗" : "View Transaction ↗"}
                  </a>
                )}
              </motion.div>
            )}

            {/* ─── Error ────────────────────────────────────────────────────── */}
            {status === "error" && (
              <motion.div 
                key="error"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center space-y-2"
              >
                <div className="text-2xl">⚠️</div>
                <div className="text-sm font-bold text-red-400">{error}</div>
              </motion.div>
            )}

            {/* ─── Processing ───────────────────────────────────────────────── */}
            {isProcessing && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 py-2"
              >
                <StageBar status={status} />
                <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-accent status-pulse" />
                  <span className="text-xs font-bold text-slate-400">{currentStep}</span>
                </div>
                {status === "approving" && approvalsNeeded > 0 && (
                  <div className="space-y-2 px-1">
                    <div className="flex justify-between text-[10px] font-black text-text-muted uppercase tracking-widest">
                      <span>{isArabic ? `الموافقات (${approvalsComplete}/${approvalsNeeded})` : `Approvals (${approvalsComplete}/${approvalsNeeded})`}</span>
                      <span>{Math.round((approvalsComplete / approvalsNeeded) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                      <motion.div
                        className="h-full bg-accent shadow-[0_0_15px_var(--accent-glow)] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(approvalsComplete / approvalsNeeded) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── Idle: Token breakdown ────────────────────────────────────── */}
            {!isProcessing && status !== "success" && status !== "error" && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {selectedTokens.length === 0 ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-20 h-20 bg-white/[0.02] rounded-3xl flex items-center justify-center mx-auto text-4xl border border-white/5 opacity-50">
                      🗑️
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-text-muted uppercase tracking-wider">{isArabic ? "سلة العملات فارغة" : "Sweep Basket Empty"}</p>
                      <p className="text-[11px] text-text-secondary font-bold uppercase tracking-tight">{isArabic ? "اختر الرموز التي تريد التخلص منها" : "Select assets to begin sweeping"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Classified results */}
                    {sweepResult ? (
                      <div className="space-y-3">
                        {sweepResult.sellQuotes.length > 0 && (
                          <div className="glass-card rounded-3xl p-5 border-emerald-500/10">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                             <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                {isArabic ? `جاهز للبيع (${sweepResult.sellQuotes.length})` : `Ready to Sell (${sweepResult.sellQuotes.length})`}
                              </span>
                            </div>
                            <div className="space-y-2.5 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                              {sweepResult.sellQuotes.map((q) => (
                                <div key={q.token.address} className="flex justify-between items-center group/item p-1">
                                  <span className="text-xs font-black text-slate-400">{q.token.symbol}</span>
                                  <span className="text-xs font-black text-white tabular-nums border-b border-white/5 pb-0.5">
                                    {formatUSDC(q.userReceives ?? 0n)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {sweepResult.burnQuotes.length > 0 && (
                          <div className="glass-card rounded-3xl p-5 border-orange-500/10 bg-orange-500/[0.01]">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                              <span className="text-[11px] font-black text-orange-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500 status-pulse" />
                                {isArabic ? `عملات ميتة (${sweepResult.burnQuotes.length})` : `Inactive Tokens (${sweepResult.burnQuotes.length})`}
                              </span>
                            </div>
                            <div className="space-y-2.5 max-h-32 overflow-y-auto pr-2 no-scrollbar">
                              {sweepResult.burnQuotes.map((q) => (
                                <div key={q.token.address} className="flex justify-between items-center">
                                  <span className="text-xs font-black text-slate-500">{q.token.symbol}</span>
                                  <span className="text-[9px] font-black text-orange-600 uppercase bg-orange-500/5 px-2 py-0.5 rounded-lg border border-orange-500/10 tracking-widest">{isArabic ? "حرق فوري" : "Instant Burn"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Preview */
                      <div className="space-y-3 glass-card rounded-3xl p-5 border-white/5">
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">معاينة العملات ({selectedTokens.length})</div>
                        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                          {selectedTokens.map((t) => (
                            <div key={t.address} className="flex items-center justify-between py-1 group/row">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-lg glass-card flex items-center justify-center text-[10px] font-black border border-white/5" style={{ color: t.logoColor }}>
                                  {t.logoLetter}
                                </div>
                                <span className="text-xs font-black text-slate-300 group-hover/row:text-white transition-colors">{t.symbol}</span>
                              </div>
                              <span className="text-xs font-bold text-slate-500 tabular-nums border-b border-white/5 pb-0.5">
                                ~${t.usdValue >= 0.01 ? t.usdValue.toFixed(2) : t.usdValue.toFixed(4)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {status === "classifying" && (
                          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                            <div className="w-3.5 h-3.5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                            <span className="text-[10px] font-black text-accent animate-pulse uppercase tracking-widest">تحليل السوق...</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price summary */}
                    <div className="glass-card rounded-3xl p-5 space-y-4 bg-white/[0.01] border-white/10 shadow-inner">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">القيمة الإجمالية</span>
                        <span className="text-sm font-black text-slate-300 tracking-tighter">${totalUSD.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">رسوم المنصة ({feePercent}%)</span>
                        <span className="text-xs font-black text-orange-500/80 tracking-tighter">−${estimatedFeeUSD.toFixed(4)}</span>
                      </div>
                      <div className="border-t border-white/5 pt-4 flex justify-between items-end group">
                        <span className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em]">{isArabic ? "ستحصل على" : "Net Receive"}</span>
                        <div className="flex flex-col items-end">
                          <span className="text-3xl font-black text-emerald-400 group-hover:scale-105 transition-transform duration-300 tracking-tighter leading-none">{netReceive}</span>
                          <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.3em] mt-1">USDC Stablecoin</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Slippage selector */}
                {selectedTokens.length > 0 && (
                  <div className="flex flex-col gap-3 bg-white/[0.02] p-4 rounded-3xl border border-white/5">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{isArabic ? "إعدادات الانزلاق (Slippage):" : "Slippage Settings:"}</span>
                    <div className="flex gap-2">
                      {SLIPPAGE_OPTIONS.map((o) => (
                        <button
                          key={o.bps}
                          onClick={() => onSlippageChange(o.bps)}
                          className={`flex-1 text-xs font-black py-2.5 rounded-2xl border transition-all duration-300 ${
                            slippageBps === o.bps
                              ? "border-accent/40 bg-accent/10 text-accent shadow-[0_0_15px_rgba(0,82,255,0.15)]"
                              : "border-white/5 bg-white/5 text-slate-500 hover:bg-white/10"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Action Button ────────────────────────────────────────────── */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={btn.isReset ? onReset : onExecute}
            disabled={btn.disabled}
            className={`group w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 disabled:opacity-50 disabled:active:scale-100 ${btnClass}`}
          >
            <div className="flex items-center justify-center gap-3">
              {(btn as { loading?: boolean }).loading && (
                <div className="w-4 h-4 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{btn.text}</span>
            </div>
          </motion.button>
        </div>

        <div className="text-[10px] font-bold text-center text-slate-600 flex flex-col items-center gap-2 uppercase tracking-tight">
          <div className="flex items-center justify-center gap-2">
            <span>{feePercent}% {isArabic ? "رسوم" : "Fee"}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-bg-surface" />
            <span className="text-text-muted">{isArabic ? "20% عمولة إحالة" : "20% Referral Commission"}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] rounded-full border border-white/5 mt-1">
            <span className="text-slate-500">Market via</span>
            <span className="text-white font-black tracking-widest flex items-center gap-1.5">
              <span className="w-3 h-3 bg-white rounded-full flex items-center justify-center text-[7px] text-black">0x</span>
              + Aerodrome + Uni V3
            </span>
          </div>
          <p className="text-[9px] text-text-muted mt-1">{isArabic ? "تغطية شاملة لسيولة Base بنسبة 100%" : "Full 100% Base Liquidity Coverage"}</p>
        </div>
      </div>
    </div>
  );
}
