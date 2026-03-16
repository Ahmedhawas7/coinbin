"use client";

import { type TokenBalance } from "@/hooks/useTokenBalances";

interface TokenRowProps {
  token: TokenBalance;
  selected: boolean;
  onToggle: () => void;
  isLive?: boolean; // coming from real-time Uniswap quote
}

export function TokenRow({ token, selected, onToggle, isLive }: TokenRowProps) {
  const hasValue = token.usdValue > 0;
  const isDead = token.balance > 0n && token.usdValue === 0;

  return (
    <tr
      onClick={token.canSell ? onToggle : undefined}
      className={`border-b border-[#1E2028]/60 transition-colors last:border-0 ${
        token.canSell
          ? selected
            ? "bg-[#0052FF]/5 hover:bg-[#0052FF]/8 cursor-pointer"
            : "hover:bg-[#0A0B0D] cursor-pointer"
          : "opacity-40"
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 pl-4 py-3">
        {token.canSell && (
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
              selected
                ? "bg-[#0052FF] border-[#0052FF]"
                : "border-[#2E3038] hover:border-[#0052FF]/40"
            }`}
          >
            {selected && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path
                  d="M1 4l2 2 4-4"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}
      </td>

      {/* Token info */}
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {token.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={token.logoUrl}
                alt={token.symbol}
                className="w-7 h-7 rounded-full"
                onError={(e) => {
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fallback = parent.querySelector(".fallback-avatar") as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <span
              className={`fallback-avatar w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${token.logoUrl ? "hidden" : "flex"}`}
              style={{ background: token.logoColor + "22", color: token.logoColor }}
            >
              {token.logoLetter}
            </span>
            {isDead && (
              <span className="absolute -top-1 -right-1 text-[8px]">🔥</span>
            )}
          </div>

          {/* Name + symbol */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white">{token.symbol}</span>
              {isDead && (
                <span className="text-[9px] text-orange-500/80 bg-orange-500/10 px-1.5 py-0.5 rounded-full border border-orange-500/20">
                  بلا سيولة
                </span>
              )}
              {!token.canSell && (
                <span className="text-[9px] text-[#0052FF]/60 bg-[#0052FF]/10 px-1.5 py-0.5 rounded-full">
                  USDC
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-600 truncate max-w-20">{token.name}</div>
          </div>
        </div>
      </td>

      {/* Balance */}
      <td className="py-3 text-right">
        <div className="text-xs text-gray-400">
          {token.balanceFormatted >= 1
            ? token.balanceFormatted.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : token.balanceFormatted.toFixed(6)}
        </div>
      </td>

      {/* Price */}
      <td className="py-3 text-right">
        <div className="text-xs text-gray-500">
          {token.usdPrice > 0
            ? `$${token.usdPrice < 0.01 ? token.usdPrice.toFixed(6) : token.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
            : "—"}
        </div>
      </td>

      {/* USD Value */}
      <td className="py-3 pr-4 text-right">
        <div className={`text-xs font-medium ${
          hasValue ? (token.usdValue >= 10 ? "text-emerald-400" : "text-gray-300") : "text-gray-700"
        }`}>
          {hasValue
            ? `$${token.usdValue >= 0.01 ? token.usdValue.toFixed(2) : token.usdValue.toFixed(6)}`
            : "—"}
        </div>
      </td>
    </tr>
  );
}
