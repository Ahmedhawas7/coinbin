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
    <div className="flex items-center gap-1 my-3">
      {stages.map((s, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1 w-full rounded-full transition-all duration-500 ${
              done ? "bg-emerald-500" : active ? "bg-[#0052FF] animate-pulse" : "bg-[#1E2028]"
            }`} />
            <span className={`text-[9px] ${
              active ? "text-[#0052FF]" : done ? "text-emerald-500" : "text-gray-700"
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

  // Auto-classify debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onAutoClassify || selectedTokens.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onAutoClassify();
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTokens.length]);

  function getButton() {
    if (!isConnected)         return { text: "ربط المحفظة أولاً",      disabled: true,  color: "gray" };
    if (status === "success") return { text: "تنظيف محفظة أخرى 🗑️",  disabled: false, color: "green", isReset: true };
    if (status === "error")   return { text: "حاول مرة أخرى",          disabled: false, color: "red" };
    if (isProcessing)         return { text: currentStep || "جارٍ...",  disabled: true,  color: "blue", loading: true };
    if (selectedTokens.length === 0)
                              return { text: "اختر رموزاً للبدء",       disabled: true,  color: "gray" };
    const sells = sweepResult?.sellQuotes.length ?? 0;
    const burns = sweepResult?.burnQuotes.length ?? 0;
    if (sells > 0 && burns > 0)
      return { text: `تأكيد: بيع ${sells} + حرق ${burns} رمز`, disabled: false, color: "blue" };
    if (sells > 0)
      return { text: `تأكيد البيع → USDC 💰`, disabled: false, color: "blue" };
    if (burns > 0)
      return { text: `حرق ${burns} رمز ميت 🔥`, disabled: false, color: "orange" };
    if (status === "classifying")
      return { text: "جارٍ تحليل الأسعار...", disabled: true, color: "blue", loading: true };
    return { text: `تحليل وبيع (${selectedTokens.length} رمز)`, disabled: false, color: "blue" };
  }

  const btn = getButton();

  const btnClass = {
    blue:   "bg-[#0052FF] hover:bg-[#0041CC] text-white shadow-lg shadow-blue-900/30",
    green:  "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30",
    red:    "bg-red-700 hover:bg-red-600 text-white",
    orange: "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/30",
    gray:   "bg-[#1A1C24] text-gray-600 cursor-not-allowed",
  }[btn.color];

  const netReceive = sweepResult
    ? formatUSDC(sweepResult.totalAfterFee)
    : `~$${(estimatedUserUSD * (1 - slippageBps / 10000)).toFixed(2)}`;

  return (
    <div className="rounded-2xl border border-[#1E2028] bg-[#0E1015] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[#1E2028] flex items-center justify-between bg-gradient-to-r from-[#0E1015] to-[#0A0D1A]">
        <div className="flex items-center gap-2">
          <span className="text-base">🗑️</span>
          <span className="text-sm font-semibold text-white">CoinBin Sweep</span>
        </div>
        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Uniswap V3 · Base
        </span>
      </div>

      <div className="p-5 space-y-4">

        {/* ─── Success ──────────────────────────────────────────────────── */}
        {status === "success" && (
          <div className="text-center py-2">
            <div className="text-4xl mb-3 animate-bounce">✅</div>
            <div className="text-base font-semibold text-white mb-1">
              المحفظة نظيفة الآن!
            </div>
            <div className="text-sm text-gray-400 mb-1">
              استلمت{" "}
              <span className="text-emerald-400 font-bold text-base">
                {sweepState.formattedUserReceives}
              </span>{" "}
              USDC
            </div>
            <div className="text-[11px] text-gray-600 mb-3">
              رسوم CoinBin: {sweepState.formattedProtocolFee}
            </div>
            {sellTxHash && (
              <a
                href={`https://basescan.org/tx/${sellTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#0052FF] hover:underline font-mono"
              >
                عرض على BaseScan ↗
              </a>
            )}
          </div>
        )}

        {/* ─── Error ────────────────────────────────────────────────────── */}
        {status === "error" && (
          <div className="bg-red-950/30 border border-red-900/30 rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">⚠️</div>
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {/* ─── Processing ───────────────────────────────────────────────── */}
        {isProcessing && (
          <>
            <StageBar status={status} />
            <div className="text-xs text-center text-gray-500">{currentStep}</div>
            {status === "approving" && approvalsNeeded > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>الموافقات</span>
                  <span>{approvalsComplete}/{approvalsNeeded}</span>
                </div>
                <div className="h-1 bg-[#1E2028] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0052FF] rounded-full transition-all duration-300"
                    style={{ width: `${(approvalsComplete / approvalsNeeded) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Idle: Token breakdown ────────────────────────────────────── */}
        {!isProcessing && status !== "success" && status !== "error" && (
          <>
            {selectedTokens.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-3xl mb-2 opacity-30">🗑️</div>
                <p className="text-sm text-gray-600">اختر رموزاً من القائمة للبدء</p>
                <p className="text-[11px] text-gray-700 mt-1">سيتم حساب السعر تلقائياً</p>
              </div>
            ) : (
              <>
                {/* Classified results or estimates */}
                {sweepResult ? (
                  <div className="space-y-2">
                    {sweepResult.sellQuotes.length > 0 && (
                      <div className="rounded-xl bg-[#0A1628] border border-[#0052FF]/10 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs">💰</span>
                          <span className="text-[11px] font-medium text-[#0052FF]">
                            للبيع ({sweepResult.sellQuotes.length} رمز)
                          </span>
                        </div>
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {sweepResult.sellQuotes.map((q) => (
                            <div key={q.token.address} className="flex justify-between text-xs">
                              <span className="text-gray-400">{q.token.symbol}</span>
                              <span className="text-emerald-400 font-medium">
                                {formatUSDC(q.userReceives ?? 0n)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {sweepResult.burnQuotes.length > 0 && (
                      <div className="rounded-xl bg-[#1A0A00] border border-orange-900/20 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs">🔥</span>
                          <span className="text-[11px] font-medium text-orange-500">
                            للحرق ({sweepResult.burnQuotes.length} رمز بلا سيولة)
                          </span>
                        </div>
                        <div className="space-y-1 max-h-20 overflow-y-auto">
                          {sweepResult.burnQuotes.map((q) => (
                            <div key={q.token.address} className="flex justify-between text-xs">
                              <span className="text-gray-500">{q.token.symbol}</span>
                              <span className="text-orange-900 text-[10px]">بلا سيولة</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Before classification — estimated preview */
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedTokens.slice(0, 7).map((t) => (
                      <div key={t.address} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {t.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.logoUrl} alt={t.symbol} className="w-4 h-4 rounded-full" onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }} />
                          ) : (
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                              style={{ background: t.logoColor + "22", color: t.logoColor }}
                            >
                              {t.logoLetter}
                            </span>
                          )}
                          <span className="text-gray-400">{t.symbol}</span>
                        </div>
                        <span className="text-gray-500">
                          ~${t.usdValue >= 0.01 ? t.usdValue.toFixed(2) : t.usdValue.toFixed(6)}
                        </span>
                      </div>
                    ))}
                    {selectedTokens.length > 7 && (
                      <div className="text-[10px] text-gray-600 text-center">
                        + {selectedTokens.length - 7} رموز أخرى
                      </div>
                    )}
                    {/* Classifying spinner */}
                    {status === "classifying" && (
                      <div className="flex items-center justify-center gap-2 py-1">
                        <span className="w-3 h-3 border-2 border-[#0052FF]/30 border-t-[#0052FF] rounded-full animate-spin" />
                        <span className="text-[10px] text-[#0052FF]/70">جارٍ حساب الأسعار...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Price summary */}
                <div className="border border-[#1E2028] rounded-xl p-3 space-y-1.5 bg-[#070809]">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>القيمة الإجمالية</span>
                    <span className="text-gray-400">${totalUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>رسوم CoinBin ({feePercent}%)</span>
                    <span className="text-orange-500/70">−${estimatedFeeUSD.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>الانزلاق ({(slippageBps / 100).toFixed(1)}%)</span>
                    <span className="text-red-500/50">−${(estimatedUserUSD * slippageBps / 10000).toFixed(4)}</span>
                  </div>
                  <div className="border-t border-[#1E2028] pt-1.5 flex justify-between font-semibold">
                    <span className="text-sm text-white">تستلم USDC</span>
                    <span className="text-base text-emerald-400">{netReceive}</span>
                  </div>
                </div>
              </>
            )}

            {/* Slippage selector */}
            {selectedTokens.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-600 whitespace-nowrap">الانزلاق:</span>
                {SLIPPAGE_OPTIONS.map((o) => (
                  <button
                    key={o.bps}
                    onClick={() => onSlippageChange(o.bps)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      slippageBps === o.bps
                        ? "border-[#0052FF]/40 bg-[#0052FF]/10 text-[#0052FF]"
                        : "border-[#1E2028] text-gray-600 hover:border-[#2E3038]"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Action Button ────────────────────────────────────────────── */}
        <button
          onClick={btn.isReset ? onReset : onExecute}
          disabled={btn.disabled}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-[0.98] ${btnClass}`}
        >
          {(btn as { loading?: boolean }).loading && (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 align-middle" />
          )}
          {btn.text}
        </button>

        <p className="text-[9px] text-center text-gray-700">
          رسوم {feePercent}% · المحيل يحصل على 20% من رسومك · Uniswap V3
        </p>
      </div>
    </div>
  );
}
