"use client";

import { type TokenBalance } from "@/hooks/useTokenBalances";
import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";

interface TokenRowProps {
  token: TokenBalance;
  selected: boolean;
  onToggle: () => void;
}

export function TokenRow({ token, selected, onToggle }: TokenRowProps) {
  const { t, isArabic } = useUI();
  const isUsdc = token.symbol === "USDC" || token.symbol === "USDbC";
  const hasValue = token.usdValue > 0;
  const isUnpriced = token.balance > 0n && token.usdValue === 0 && !isUsdc;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.005, y: -1 }}
      whileTap={{ scale: 0.995 }}
      onClick={onToggle}
      className={`relative overflow-hidden cursor-pointer transition-all duration-300 rounded-[1.25rem] border ${
        selected
          ? "bg-accent/[0.08] border-accent/40 shadow-xl"
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
              selected ? "border-accent/30" : "border-divider bg-bg-elevated"
            }`}>
              {token.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={token.logoUrl} alt={token.symbol} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-black" style={{ color: token.logoColor }}>
                  {token.logoLetter}
                </span>
              )}
            </div>
            {isUnpriced && (
              <div className="absolute -top-1.5 -right-1.5 text-[10px] bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-lg border border-white/20">🔍</div>
            )}
          </div>

          {/* Token Identification */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base font-black text-text-primary tracking-tight">{token.symbol}</span>
              {isUnpriced && (
                <span className="text-[8.5px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 uppercase tracking-widest border border-blue-500/20">
                  {t.unindexedLiquidity}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider truncate max-w-[150px] opacity-80">
              {token.name}
            </span>
          </div>
        </div>

        {/* Balance and Value - Responsive Layout */}
        <div className="flex md:items-center justify-between md:justify-end gap-10 md:gap-16 pl-12 md:pl-0 border-t border-divider pt-4 md:border-0 md:pt-0">
          <div className="flex flex-col md:items-end">
            <span className="v-stat-label md:hidden mb-1">{isArabic ? "الرصيد" : "Balance"}</span>
            <span className="text-sm font-bold text-text-secondary tabular-nums">
              {token.balanceFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>

          <div className="flex flex-col md:items-end min-w-[100px]">
            <span className="v-stat-label md:hidden mb-1">{isArabic ? "القيمة" : "Value"}</span>
            <span className={`text-base font-black tabular-nums transition-colors ${
              hasValue ? (token.usdValue >= 5 ? "text-emerald-500" : "text-text-primary") : "text-text-muted/50"
            }`}>
              {hasValue ? (token.usdValue >= 0.01 ? `$${token.usdValue.toFixed(2)}` : `$${token.usdValue.toFixed(4)}`) : "$0.00"}
            </span>
          </div>
        </div>
      </div>

      {/* Modern interaction highlight */}
      {selected && (
        <motion.div
          layoutId={`highlight-${token.address}`}
          className="absolute inset-0 bg-accent/5 pointer-events-none"
        />
      )}
    </motion.div>
  );
}
