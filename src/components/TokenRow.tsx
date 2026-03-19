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
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onToggle}
      className={`relative overflow-hidden cursor-pointer transition-all duration-300 rounded-2xl border ${
        selected
          ? "bg-accent/10 border-accent/30 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]"
          : "bg-white/[0.02] border-white/5 hover:border-white/10"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center p-4 md:px-6 md:py-4 gap-4">
        {/* Selection + Token Info Wrapper */}
        <div className="flex items-center gap-4 flex-1">
          {/* Custom Checkbox */}
          <div
            className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
              selected
                ? "bg-accent border-accent shadow-[0_0_15px_var(--accent-glow)]"
                : "border-white/10"
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
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center overflow-hidden">
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
              <div className="absolute -top-1 -right-1 text-[10px] opacity-70">🔍</div>
            )}
          </div>

          {/* Token Identification */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-text-primary">{token.symbol}</span>
              {isUnpriced && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-widest border border-blue-500/20">
                  {t.unindexedLiquidity}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight truncate max-w-[120px]">
              {token.name}
            </span>
          </div>
        </div>

        {/* Balance and Value - Responsive Layout */}
        <div className="flex md:items-center justify-between md:justify-end gap-6 md:gap-12 pl-10 md:pl-0 border-t border-white/5 pt-3 md:border-0 md:pt-0">
          <div className="flex flex-col md:items-end">
            <span className="text-[10px] font-bold text-text-muted md:hidden uppercase tracking-widest mb-1">{isArabic ? "الرصيد" : "Balance"}</span>
            <span className="text-xs font-bold text-text-secondary">
              {token.balanceFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          </div>

          <div className="flex flex-col md:items-end min-w-[80px]">
            <span className="text-[10px] font-bold text-text-muted md:hidden uppercase tracking-widest mb-1">{isArabic ? "القيمة" : "Value"}</span>
            <span className={`text-sm font-black tabular-nums ${
              hasValue ? (token.usdValue >= 5 ? "text-emerald-400" : "text-text-primary") : "text-text-muted"
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
