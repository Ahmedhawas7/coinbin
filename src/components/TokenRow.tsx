"use client";

import { type TokenBalance } from "@/hooks/useTokenBalances";

interface TokenRowProps {
  token: TokenBalance;
  selected: boolean;
  onToggle: () => void;
  isLive?: boolean; // coming from real-time Uniswap quote
}

export function TokenRow({ token, selected, onToggle, isLive }: TokenRowProps) {
  const isUsdc = token.symbol === "USDC" || token.symbol === "USDbC";
  const hasValue = token.usdValue > 0;
  // Only show as possibly dead if it has NO value from Gecko AND it's not a stablecoin we already know.
  const isPossiblyDead = token.balance > 0n && token.usdValue === 0 && !isUsdc;

  return (
    <tr
      onClick={onToggle}
      className={`border-b border-white/[0.04] transition-all duration-300 row-hover group last:border-0 ${
        selected
          ? "bg-base-blue/10 hover:bg-base-blue/15"
          : "hover:bg-white/[0.02]"
      }`}
    >
      {/* Checkbox */}
      <td className="w-12 pl-5 py-4">
        <div
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
            selected
              ? "bg-base-blue border-base-blue shadow-[0_0_15px_rgba(0,82,255,0.4)]"
              : "border-white/10 group-hover:border-base-blue/40"
          }`}
        >
            {selected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5l2 2 4-4"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
      </td>

      {/* Token info */}
      <td className="py-4 pr-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl glass-card flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-base-blue/30 transition-colors">
              {token.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={token.logoUrl}
                  alt={token.symbol}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.classList.remove("hidden");
                  }}
                />
              ) : null}
              <span
                className={`w-full h-full items-center justify-center text-sm font-bold ${token.logoUrl ? "hidden" : "flex"}`}
                style={{ background: token.logoColor + "15", color: token.logoColor }}
              >
                {token.logoLetter}
              </span>
            </div>
            {isPossiblyDead && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[10px] shadow-lg border border-black/20">
                🔥
              </div>
            )}
          </div>

          {/* Name + symbol */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white group-hover:text-base-blue transition-colors">{token.symbol}</span>
              {isPossiblyDead && (
                <span className="text-[10px] font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">
                  بلا سيولة
                </span>
              )}
              {!token.canSell && isUsdc && (
                <span className="text-[10px] font-black text-white bg-base-blue px-2 py-0.5 rounded-lg border border-white/20 shadow-[0_0_10px_rgba(0,82,255,0.3)]">
                  رصيد آمن ✨
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 truncate max-w-[120px] font-medium mt-0.5">{token.name}</div>
          </div>
        </div>
      </td>

      {/* Balance */}
      <td className="py-4 text-right">
        <div className="text-sm font-semibold text-slate-300">
          {token.balanceFormatted >= 1
            ? token.balanceFormatted.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : token.balanceFormatted.toFixed(6)}
        </div>
      </td>

      {/* Price */}
      <td className="py-4 text-right">
        <div className="text-sm font-medium text-slate-500">
          {token.usdPrice > 0
            ? `$${token.usdPrice < 0.01 ? token.usdPrice.toFixed(6) : token.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
            : "—"}
        </div>
      </td>

      {/* USD Value */}
      <td className="py-4 pr-5 text-right">
        <div className={`text-sm font-bold tabular-nums ${
          hasValue ? (token.usdValue >= 10 ? "text-emerald-400" : "text-white") : "text-slate-700"
        }`}>
          {hasValue
            ? `$${token.usdValue >= 0.01 ? token.usdValue.toFixed(2) : token.usdValue.toFixed(6)}`
            : "$0.00"}
        </div>
      </td>
    </tr>
  );
}
