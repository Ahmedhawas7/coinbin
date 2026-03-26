// src/components/TokenRow.tsx
"use client";

import { type TokenBalance } from "@/hooks/useTokenBalances";
import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";

interface TokenRowProps {
  token: TokenBalance;
  selected: boolean;
  onToggle: () => void;
  onBurn?: () => void;
  isBurning?: boolean;
}

export function TokenRow({ token, selected, onToggle, onBurn, isBurning }: TokenRowProps) {
  const { t, isArabic } = useUI();
  const isUsdc = token.symbol === "USDC" || token.symbol === "USDbC";
  const hasValue = token.usdValue > 0;
  
  const getStatusLabel = () => {
    switch (token.status) {
      case "PRICED": return null;
      case "HIDDEN": return isArabic ? "مخفي" : "HIDDEN";
      case "NO_LIQUIDITY": return isArabic ? "بلا سيولة" : "NO LIQUIDITY";
      case "DEAD": return isArabic ? "ميت" : "DEAD";
      default: return null;
    }
  };

  const statusLabel = getStatusLabel();
  const isUnpriced = token.status !== "PRICED" && !isUsdc;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.005, y: -1 }}
      onClick={onToggle}
      className={`relative overflow-hidden cursor-pointer transition-all duration-300 rounded-[1.25rem] border ${
        selected
          ? "bg-accent/[0.08] border-accent/40 shadow-xl"
          : isUnpriced
          ? "bg-orange-500/[0.03] border-orange-500/20 hover:border-orange-500/40"
          : "bg-bg-surface border-divider hover:border-text-muted/30"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center p-4 md:px-7 md:py-5 gap-4">
        {/* Selection + Token Info Wrapper */}
        <div className="flex items-center gap-5 flex-1">
          {/* Custom Checkbox */}
          <div
            className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
              selected
                ? "bg-accent border-accent shadow-lg shadow-accent/20"
                : "border-divider bg-bg-elevated"
            }`}
          >
            {selected && (
              <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          {/* Token Visuals */}
          <div className="relative">
            <div className={`w-12 h-12 md:w-10 md:h-10 rounded-xl flex items-center justify-center overflow-hidden border shadow-sm ${
              selected ? "border-accent/30" : isUnpriced ? "border-orange-500/30 bg-orange-500/5" : "border-divider bg-bg-elevated"
            }`}>
              {token.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={token.logoUrl} alt={token.symbol} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-black">
                  {token.symbol[0]}
                </span>
              )}
            </div>
            {isUnpriced && (
              <div className="absolute -top-1.5 -right-1.5 text-[10px] bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-lg border border-white/20">🔥</div>
            )}
          </div>

          {/* Token Identification */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base font-black text-text-primary tracking-tight">{token.symbol}</span>
              {statusLabel && (
                <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                  token.status === "HIDDEN" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                }`}>
                  {statusLabel}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider truncate max-w-[150px] opacity-80">
              {token.address.slice(0, 6)}...{token.address.slice(-4)}
            </span>
          </div>
        </div>

        {/* Balance, Value & Direct Burn */}
        <div className="flex md:items-center justify-between md:justify-end gap-6 md:gap-10 pl-12 md:pl-0 border-t border-divider pt-4 md:border-0 md:pt-0">
          <div className="flex flex-col md:items-end">
            <span className="v-stat-label md:hidden mb-1">{isArabic ? "الرصيد" : "Balance"}</span>
            <span className="text-sm font-bold text-text-secondary tabular-nums">
              {token.balanceFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>

          <div className="flex flex-col md:items-end min-w-[80px]">
            <span className="v-stat-label md:hidden mb-1">{isArabic ? "القيمة" : "Value"}</span>
            <span className={`text-base font-black tabular-nums transition-colors ${
              hasValue ? (token.usdValue >= 5 ? "text-emerald-500" : "text-text-primary") : "text-text-muted/50"
            }`}>
              {hasValue ? (token.usdValue >= 0.01 ? `$${token.usdValue.toFixed(2)}` : `$${token.usdValue.toFixed(4)}`) : "—"}
            </span>
          </div>

          {/* Direct Burn Button for illiquid tokens */}
          {isUnpriced && onBurn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBurn();
              }}
              disabled={isBurning}
              title={isArabic ? "حرق مباشر" : "Burn directly (free)"}
              className="flex-shrink-0 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              {isBurning ? "..." : `🔥 ${isArabic ? "حرق" : "Burn"}`}
            </button>
          )}
        </div>
      </div>

      {/* Selection highlight */}
      {selected && (
        <motion.div
          layoutId={`highlight-${token.address}`}
          className="absolute inset-0 bg-accent/5 pointer-events-none"
        />
      )}
    </motion.div>
  );
}
