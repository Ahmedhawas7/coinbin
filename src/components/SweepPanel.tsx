"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { type SweepState } from "@/hooks/useSweep";
import { type TokenBalance } from "@/hooks/useTokenBalances";
import { formatUSDC, calcProtocolFeeUSD } from "@/lib/sweep";
import { PROTOCOL_FEE_BPS } from "@/config/contracts";

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
  const stages = [
    { id: "classifying", label: "تحليل" },
    { id: "approving",   label: "موافقة" },
    { id: "selling",     label: "بيع" },
    { id: "burning",     label: "حرق" },
    { id: "success",     label: "اكتمل" },
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
              done ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : active ? "bg-slate-800" : "bg-slate-900"
            }`}>
              {active && (
                <div className="absolute inset-0 bg-base-blue animate-[shimmer_2s_linear_infinite] shadow-[0_0_15px_rgba(0,82,255,0.6)]" />
              )}
            </div>
            <span className={`text-[10px] font-bold tracking-tight transition-colors duration-300 ${
              active ? "text-base-blue" : done ? "text-emerald-500" : "text-slate-600"
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
  onAutoClassify,
}: SweepPanelProps) {
  const { status, sweepResult, currentStep, sellTxHash, error,
          approvalsNeeded, approvalsComplete } = sweepState;
  const isProcessing = ["classifying", "approving", "selling", "burning"].includes(status);

  const totalUSD = selectedTokens.reduce((s, t) => s + t.usdValue, 0);
  const estimatedFeeUSD = calcProtocolFeeUSD(totalUSD);
  const estimatedUserUSD = totalUSD - estimatedFeeUSD;
  const feePercent = Number(PROTOCOL_FEE_BPS) / 100;

  // ... (keeping auto-classify useEffect as is) ...

  function getButton() {
    if (!isConnected)         return { text: "ربط المحفظة للبدء",      disabled: true,  color: "gray" };
    if (status === "success") return { text: "تنظيف محفظة أخرى 🗑️",  disabled: false, color: "green", isReset: true };
    if (status === "error")   return { text: "إعادة المحاولة",          disabled: false, color: "red" };
    if (isProcessing)         return { text: currentStep || "جارٍ المعالجة...",  disabled: true,  color: "blue", loading: true };
    if (selectedTokens.length === 0)
                              return { text: "اختر رموزاً للبدء",       disabled: true,  color: "gray" };
    const sells = sweepResult?.sellQuotes.length ?? 0;
    const burns = sweepResult?.burnQuotes.length ?? 0;
    if (sells > 0 && burns > 0)
      return { text: `تنفيذ: بيع ${sells} + حرق ${burns}`, disabled: false, color: "blue" };
    if (sells > 0)
      return { text: `تأكيد البيع → USDC 💰`, disabled: false, color: "blue" };
    if (burns > 0)
      return { text: `حرق ${burns} رموز ميتة 🔥`, disabled: false, color: "orange" };
    if (status === "classifying")
      return { text: "جارٍ تحليل السيولة...", disabled: true, color: "blue", loading: true };
    return { text: `بدء التنظيف (${selectedTokens.length} رمز)`, disabled: false, color: "blue" };
  }

  const btn = getButton();

  const btnClass = {
    blue:   "bg-base-blue hover:bg-[#0041CC] text-white glow-accent",
    green:  "bg-emerald-600 hover:bg-emerald-500 text-white glow-success",
    red:    "bg-red-600 hover:bg-red-500 text-white",
    orange: "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/30",
    gray:   "bg-slate-900 text-slate-600 cursor-not-allowed border border-white/5",
  }[btn.color];

  const netReceive = sweepResult
    ? formatUSDC(sweepResult.totalAfterFee)
    : `~$${(estimatedUserUSD * (1 - slippageBps / 10000)).toFixed(2)}`;

  return (
    <div className="glass rounded-3xl overflow-hidden border border-white/10 glow-accent shadow-2xl sticky top-6">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-base-blue/10 flex items-center justify-center text-lg border border-base-blue/20">
            🗑️
          </div>
          <span className="text-sm font-black text-white uppercase tracking-tighter">CoinBin Sweep</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live · Base</span>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ─── Success ──────────────────────────────────────────────────── */}
        {status === "success" && (
          <div className="text-center py-4 space-y-4 animate-fade-in group">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-4xl shadow-[0_0_40px_rgba(16,185,129,0.2)] border border-emerald-500/30 group-hover:scale-110 transition-transform duration-500">
              ✅
            </div>
            <div className="space-y-1">
              <div className="text-lg font-black text-white">تم التنظيف!</div>
              <div className="text-sm text-slate-400">
                استلمت <span className="text-emerald-400 font-bold">{sweepState.formattedUserReceives}</span> USDC
              </div>
            </div>
            {sellTxHash && (
              <a
                href={`https://basescan.org/tx/${sellTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-base-blue hover:bg-base-blue/10 transition-colors font-bold uppercase tracking-wider"
              >
                عرض المعاملة ↗
              </a>
            )}
          </div>
        )}

        {/* ─── Error ────────────────────────────────────────────────────── */}
        {status === "error" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center space-y-2">
            <div className="text-2xl">⚠️</div>
            <div className="text-sm font-medium text-red-400">{error}</div>
          </div>
        )}

        {/* ─── Processing ───────────────────────────────────────────────── */}
        {isProcessing && (
          <div className="space-y-4 py-2">
            <StageBar status={status} />
            <div className="glass-card rounded-xl p-3 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-base-blue status-pulse" />
              <span className="text-xs font-bold text-slate-400">{currentStep}</span>
            </div>
            {status === "approving" && approvalsNeeded > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <span>الموافقات المطلوبة</span>
                  <span>{approvalsComplete}/{approvalsNeeded}</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-base-blue shadow-[0_0_10px_rgba(0,82,255,0.5)] transition-all duration-700 ease-out"
                    style={{ width: `${(approvalsComplete / approvalsNeeded) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Idle: Token breakdown ────────────────────────────────────── */}
        {!isProcessing && status !== "success" && status !== "error" && (
          <>
            {selectedTokens.length === 0 ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-900/50 rounded-2xl flex items-center justify-center mx-auto text-3xl border border-white/5 opacity-50">
                  🗑️
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-400">سلة العملات فارغة</p>
                  <p className="text-[11px] text-slate-600">اختر الرموز التي تريد التخلص منها</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Classified results */}
                {sweepResult ? (
                  <div className="space-y-3">
                    {sweepResult.sellQuotes.length > 0 && (
                      <div className="glass-card rounded-2xl p-4 border-emerald-500/10">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            جاهز للبيع ({sweepResult.sellQuotes.length})
                          </span>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {sweepResult.sellQuotes.map((q) => (
                            <div key={q.token.address} className="flex justify-between items-center group/item hover:bg-white/[0.02] p-1 rounded-lg transition-colors">
                              <span className="text-xs font-bold text-slate-400 group-hover/item:text-white transition-colors">{q.token.symbol}</span>
                              <span className="text-xs font-black text-white tabular-nums">
                                {formatUSDC(q.userReceives ?? 0n)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sweepResult.burnQuotes.length > 0 && (
                      <div className="glass-card rounded-2xl p-4 border-orange-500/10">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                          <span className="text-[11px] font-black text-orange-500 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            عملات ميتة ({sweepResult.burnQuotes.length})
                          </span>
                        </div>
                        <div className="space-y-2 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                          {sweepResult.burnQuotes.map((q) => (
                            <div key={q.token.address} className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-500">{q.token.symbol}</span>
                              <span className="text-[10px] font-black text-orange-900 uppercase">حرق فوري</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Preview */
                  <div className="space-y-3 glass-card rounded-2xl p-4 border-white/5">
                    <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">معاينة العملات ({selectedTokens.length})</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {selectedTokens.map((t) => (
                        <div key={t.address} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md glass-card flex items-center justify-center text-[10px] font-bold border border-white/5" style={{ color: t.logoColor }}>
                              {t.logoLetter}
                            </div>
                            <span className="text-xs font-bold text-slate-300">{t.symbol}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-500 tabular-nums">
                            ~${t.usdValue >= 0.01 ? t.usdValue.toFixed(2) : t.usdValue.toFixed(6)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {status === "classifying" && (
                      <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                        <div className="w-3 h-3 border-2 border-base-blue/20 border-t-base-blue rounded-full animate-spin" />
                        <span className="text-[11px] font-bold text-base-blue animate-pulse uppercase tracking-wider">جارٍ تحليل السوق...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Price summary */}
                <div className="glass-card rounded-2xl p-4 space-y-3 bg-white/[0.01] border-white/10">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">القيمة الإجمالية</span>
                    <span className="text-sm font-bold text-slate-300 tracking-tight">${totalUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">رسوم المنصة ({feePercent}%)</span>
                    <span className="text-xs font-bold text-orange-500/80 tracking-tight">−${estimatedFeeUSD.toFixed(4)}</span>
                  </div>
                  <div className="border-t border-white/5 pt-3 flex justify-between items-end group">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">ستحصل على</span>
                    <span className="text-2xl font-black text-emerald-400 group-hover:scale-110 transition-transform duration-300 tracking-tighter">{netReceive} <span className="text-xs">USDC</span></span>
                  </div>
                </div>
              </div>
            )}

            {/* Slippage selector */}
            {selectedTokens.length > 0 && (
              <div className="flex items-center gap-3 bg-white/[0.02] p-2 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter ml-1">الانزلاق:</span>
                <div className="flex gap-1 flex-1">
                  {SLIPPAGE_OPTIONS.map((o) => (
                    <button
                      key={o.bps}
                      onClick={() => onSlippageChange(o.bps)}
                      className={`flex-1 text-[11px] font-black py-1.5 rounded-xl border transition-all duration-300 ${
                        slippageBps === o.bps
                          ? "border-base-blue/40 bg-base-blue/10 text-base-blue shadow-[0_0_15px_rgba(0,82,255,0.15)]"
                          : "border-transparent text-slate-500 hover:bg-white/5"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Action Button ────────────────────────────────────────────── */}
        <button
          onClick={btn.isReset ? onReset : onExecute}
          disabled={btn.disabled}
          className={`group w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${btnClass}`}
        >
          <div className="flex items-center justify-center gap-3">
            {(btn as { loading?: boolean }).loading && (
              <div className="w-4 h-4 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span className="group-hover:tracking-[0.2em] transition-all duration-300">{btn.text}</span>
          </div>
        </button>
 
        <div className="text-[10px] font-bold text-center text-slate-600 flex items-center justify-center gap-2 uppercase tracking-tight">
          <span>{feePercent}% رسوم</span>
          <span className="w-1 h-1 rounded-full bg-slate-800" />
          <span className="text-slate-500">20% عمولة إحالة</span>
          <span className="w-1 h-1 rounded-full bg-slate-800" />
          <span>Uniswap V3</span>
        </div>
      </div>
    </div>
  );
}
