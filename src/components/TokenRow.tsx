"use client";

import { type TokenBalance } from "@/hooks/useTokenBalances";

interface TokenRowProps {
  token: TokenBalance;
  selected: boolean;
  onToggle: () => void;
}

export function TokenRow({ token, selected, onToggle }: TokenRowProps) {
  const isUsdc = token.symbol === "USDC" || token.symbol === "USDbC";
  const hasValue = token.usdValue > 0;
  const isPossiblyDead = token.balance > 0n && token.usdValue === 0 && !isUsdc;

  return (
    <tr
      onClick={onToggle}
      className={`border-b border-white/[0.04] transition-all duration-300 row-hover group last:border-0 cursor-pointer ${
        selected
          ? "bg-base-blue/10 hover:bg-base-blue/15"
          : "hover:bg-white/[0.02]"
      }`}
    >
      {/* Checkbox */}
      <td className="w-14 pl-6 py-4">
        <div
          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
            selected
              ? "bg-base-blue border-base-blue shadow-[0_0_15px_rgba(0,82,255,0.3)]"
              : "border-white/10 group-hover:border-white/20"
          }`}
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </td>

      {/* Token info */}
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-base-blue/30 transition-colors">
              {token.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={token.logoUrl} alt={token.symbol} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-black" style={{ color: token.logoColor }}>
                  {token.logoLetter}
                </span>
              )}
            </div>
            {isPossiblyDead && (
              <div className="absolute -top-1 -right-1 text-[10px]">🔥</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-white">{token.symbol}</div>
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter truncate max-w-[80px]">{token.name}</div>
          </div>
        </div>
      </td>

      {/* Balance */}
      <td className="py-4 text-left">
        <div className="text-xs font-bold text-slate-400">
          {token.balanceFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </div>
      </td>

      {/* USD Value */}
      <td className="py-4 pr-6 text-left">
        <div className={`text-xs font-black tabular-nums ${
          hasValue ? (token.usdValue >= 5 ? "text-emerald-400" : "text-white") : "text-slate-800"
        }`}>
          {hasValue ? `$${token.usdValue.toFixed(2)}` : "$0.00"}
        </div>
      </td>
    </tr>
  );
}
