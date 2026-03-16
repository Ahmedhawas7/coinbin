"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useSweep } from "@/hooks/useSweep";
import { TokenRow } from "@/components/TokenRow";
import { SweepPanel } from "@/components/SweepPanel";
import { StatsBar } from "@/components/StatsBar";
import { ReferralCard } from "@/components/ReferralCard";
import { PostSweepModal } from "@/components/PostSweepModal";
import { saveReferrer, getReferrerFromURL, getActiveReferrer } from "@/lib/referral";
import { executeBurn } from "@/lib/sweep";
import { useWalletClient } from "wagmi";
import Link from "next/link";

type FilterType = "all" | "dust" | "high" | "nonzero" | "dead";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { tokens, loading, error, refetch, totalUSDValue, dustTokens, deadTokens } =
    useTokenBalances();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [showPostModal, setShowPostModal] = useState(false);
  const [isBurningDead, setIsBurningDead] = useState(false);
  const [referrer, setReferrer] = useState<`0x${string}` | undefined>(undefined);

  const { state: sweepState, classify, execute, reset } = useSweep();

  // Read referrer from URL on mount
  useEffect(() => {
    const urlRef = getReferrerFromURL();
    if (urlRef) saveReferrer(urlRef);
    const r = getActiveReferrer();
    if (r) setReferrer(r as `0x${string}`);
  }, []);

  // Show post-sweep modal on success
  useEffect(() => {
    if (sweepState.status === "success") {
      setTimeout(() => setShowPostModal(true), 600);
    }
  }, [sweepState.status]);

  // ─── Filtered token list ─────────────────────────────────────────────────
  const filteredTokens = useMemo(() => {
    let list = [...tokens];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      );
    }
    if (filter === "dust")   list = list.filter((t) => t.usdValue > 0 && t.usdValue < 1);
    if (filter === "high")   list = list.filter((t) => t.usdValue >= 10);
    if (filter === "nonzero") list = list.filter((t) => t.usdValue > 0);
    if (filter === "dead")   list = list.filter((t) => t.balance > 0n && t.usdValue === 0);
    return list;
  }, [tokens, search, filter]);

  const selectedTokens = useMemo(
    () => tokens.filter((t) => selected.has(t.address) && t.canSell),
    [tokens, selected]
  );

  const selectedValue = selectedTokens.reduce((s, t) => s + t.usdValue, 0);

  // ─── Toggle handlers ────────────────────────────────────────────────────
  const toggleToken = useCallback((address: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
    // Reset sweep result when selection changes
    if (sweepState.sweepResult) reset();
  }, [sweepState.sweepResult, reset]);

  const toggleAll = useCallback(() => {
    const sellable = filteredTokens.filter((t) => t.canSell);
    const allSelected = sellable.every((t) => selected.has(t.address));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        sellable.forEach((t) => next.delete(t.address));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        sellable.forEach((t) => next.add(t.address));
        return next;
      });
    }
    if (sweepState.sweepResult) reset();
  }, [filteredTokens, selected, sweepState.sweepResult, reset]);

  const selectDustOnly = useCallback(() => {
    const dust = tokens.filter((t) => t.usdValue > 0 && t.usdValue < 1 && t.canSell);
    setSelected(new Set(dust.map((t) => t.address)));
    if (sweepState.sweepResult) reset();
  }, [tokens, sweepState.sweepResult, reset]);

  // ─── Auto-classify on selection change ─────────────────────────────────
  const handleAutoClassify = useCallback(async () => {
    if (selectedTokens.length === 0) return;
    const tokensToProcess = selectedTokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      balance: t.balance,
      decimals: t.decimals,
      usdValue: t.usdValue,
    }));
    await classify(tokensToProcess, slippageBps, referrer);
  }, [selectedTokens, slippageBps, classify, referrer]);

  // ─── Execute sweep ───────────────────────────────────────────────────────
  const handleSweep = useCallback(async () => {
    if (sweepState.status === "error") { reset(); return; }

    const tokensToProcess = selectedTokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      balance: t.balance,
      decimals: t.decimals,
      usdValue: t.usdValue,
    }));

    if (!sweepState.sweepResult) {
      await classify(tokensToProcess, slippageBps, referrer);
      return;
    }

    await execute(sweepState.sweepResult, slippageBps);
  }, [selectedTokens, slippageBps, classify, execute, sweepState, reset, referrer]);

  const handleReset = useCallback(() => {
    reset();
    setSelected(new Set());
    setShowPostModal(false);
    refetch();
  }, [reset, refetch]);

  // ─── Burn dead tokens ────────────────────────────────────────────────────
  const handleBurnDead = useCallback(async () => {
    if (!walletClient || !address || deadTokens.length === 0) return;
    setIsBurningDead(true);
    try {
      const deadQuotes = deadTokens.map((t) => ({
        token: {
          address: t.address,
          symbol: t.symbol,
          balance: t.balance,
          decimals: t.decimals,
          usdValue: t.usdValue,
        },
        action: "burn" as const,
        amountIn: t.balance,
      }));
      await executeBurn(walletClient, deadQuotes, address);
      await refetch();
      setShowPostModal(false);
    } catch { /* ignore */ }
    finally { setIsBurningDead(false); }
  }, [walletClient, address, deadTokens, refetch]);

  const allSellableSelected =
    filteredTokens.filter((t) => t.canSell).length > 0 &&
    filteredTokens.filter((t) => t.canSell).every((t) => selected.has(t.address));

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070809]">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-[#1E2028] bg-[#070809]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0052FF] flex items-center justify-center shadow-lg shadow-blue-900/30">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="8" fill="white" opacity="0.15" />
                <path d="M9 2C5.134 2 2 5.134 2 9C2 12.866 5.134 16 9 16C12.866 16 16 12.866 16 9C16 5.134 12.866 2 9 2ZM9 14C6.243 14 4 11.757 4 9C4 6.243 6.243 4 9 4C11.757 4 14 6.243 14 9C14 11.757 11.757 14 9 14Z" fill="white" />
                <circle cx="9" cy="9" r="2.5" fill="white" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">CoinBin 🗑️</div>
              <div className="text-[10px] text-gray-600 mt-0.5">نظّف محفظتك — ابدأ من جديد</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0052FF]/5 border border-[#0052FF]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
              <span className="text-[11px] text-[#0052FF]">Base Mainnet</span>
            </div>
            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1E2028] text-[11px] text-gray-500 hover:text-gray-300 hover:border-[#2E3038] transition-all"
            >
              📊 لوحة المالك
            </Link>

            <Wallet>
              <ConnectWallet className="!bg-[#0052FF] !text-white !rounded-xl !text-sm !px-4 !py-2 hover:!bg-[#0041CC] transition-colors font-medium">
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {!isConnected ? (
          /* ─── Landing / Not Connected ────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">

            {/* Hero */}
            <div className="w-24 h-24 rounded-3xl bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center mb-8 glow-blue">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <rect x="6" y="12" width="32" height="22" rx="4" stroke="#0052FF" strokeWidth="2.5" />
                <path d="M6 18h32" stroke="#0052FF" strokeWidth="2.5" />
                <circle cx="30" cy="26" r="2.5" fill="#0052FF" />
                <circle cx="24" cy="26" r="2.5" fill="#0052FF" opacity="0.5" />
              </svg>
            </div>

            <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
              نظّف محفظتك 🗑️<br />
              <span className="text-[#0052FF]">واستقبل USDC</span>
            </h1>
            <p className="text-gray-500 text-base mb-10 max-w-md leading-relaxed">
              اكتشف جميع توكناتك على Base، بيع كل شيء دفعة واحدة، واحرق التوكنات الميتة.<br />
              <span className="text-gray-400">بضغطة واحدة.</span>
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full max-w-lg">
              {[
                { icon: "🔍", title: "اكتشاف تلقائي", desc: "جميع توكناتك على Base" },
                { icon: "💰", title: "بيع دفعة واحدة", desc: "عبر Uniswap V3 بأفضل سعر" },
                { icon: "🔥", title: "حرق الميت", desc: "تنظيف كامل بضغطة واحدة" },
              ].map((f, i) => (
                <div key={i} className="bg-[#0E1015] border border-[#1E2028] rounded-2xl p-4 text-center hover:border-[#0052FF]/20 transition-colors">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <div className="text-sm font-semibold text-white mb-1">{f.title}</div>
                  <div className="text-[11px] text-gray-600">{f.desc}</div>
                </div>
              ))}
            </div>

            {/* Referral teaser */}
            <div className="mb-8 px-4 py-3 rounded-xl border border-amber-900/30 bg-amber-950/20 text-sm text-amber-400/80">
              🔗 اربح <strong>20%</strong> من رسوم كل صديق تدعوه — تلقائياً وإلى الأبد
            </div>

            <Wallet>
              <ConnectWallet className="!bg-[#0052FF] !text-white !rounded-2xl !text-base !px-10 !py-4 hover:!bg-[#0041CC] transition-colors font-semibold shadow-xl shadow-blue-900/30">
                <span>ربط المحفظة والبدء</span>
              </ConnectWallet>
            </Wallet>

            <div className="mt-6 flex items-center gap-6 text-[11px] text-gray-700">
              <span className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Coinbase Wallet</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> MetaMask</span>
              <span className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> WalletConnect</span>
            </div>
          </div>
        ) : (
          /* ─── Connected: Dashboard ───────────────────────────────────── */
          <>
            <StatsBar
              totalValue={totalUSDValue}
              tokenCount={tokens.filter((t) => t.canSell).length}
              dustCount={dustTokens.length}
              deadCount={deadTokens.length}
              selectedCount={selectedTokens.length}
              selectedValue={selectedValue}
              loading={loading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
              {/* ─── Token List ─────────────────────────────────────────── */}
              <div>
                {/* Controls */}
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={toggleAll}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#1E2028] text-gray-400 hover:border-[#2E3038] hover:text-gray-200 transition-all"
                    >
                      {allSellableSelected ? "إلغاء الكل" : "تحديد الكل"}
                    </button>
                    <button
                      onClick={selectDustOnly}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#1E2028] text-amber-500/70 hover:border-amber-500/30 hover:text-amber-400 transition-all"
                    >
                      الغبار ({dustTokens.length})
                    </button>
                    {(["all", "nonzero", "high", "dead"] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          filter === f
                            ? "bg-[#0052FF]/10 border-[#0052FF]/30 text-[#0052FF]"
                            : "border-[#1E2028] text-gray-500 hover:border-[#2E3038]"
                        }`}
                      >
                        {f === "all" ? "الكل" : f === "nonzero" ? "غير صفري" : f === "high" ? "قيمة عالية" : `ميت 🔥 (${deadTokens.length})`}
                      </button>
                    ))}
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="بحث..."
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#1E2028] bg-transparent text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-[#0052FF]/30 w-28 transition-colors"
                  />
                </div>

                {/* Table */}
                <div className="rounded-2xl border border-[#1E2028] overflow-hidden">
                  {error ? (
                    <div className="p-8 text-center text-red-400 text-sm">
                      <div className="text-2xl mb-2">⚠️</div>
                      <div className="mb-3">خطأ في جلب الأرصدة</div>
                      <div className="mb-3 text-xs opacity-70 break-words">{error}</div>
                      <button onClick={refetch} className="text-xs text-[#0052FF] hover:underline">
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : loading ? (
                    <div className="p-10 text-center">
                      <div className="inline-block w-8 h-8 border-2 border-[#1E2028] border-t-[#0052FF] rounded-full animate-spin mb-4" />
                      <div className="text-sm text-gray-600">جارٍ تحميل الأرصدة...</div>
                      <div className="text-[11px] text-gray-700 mt-1">يتم فحص جميع توكناتك على Base</div>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1E2028] bg-[#0A0B0D]">
                          <th className="w-10 pl-4 py-2.5" />
                          <th className="text-[10px] text-gray-600 font-normal text-right uppercase tracking-widest py-2.5 pr-3">الرمز</th>
                          <th className="text-[10px] text-gray-600 font-normal text-right uppercase tracking-widest py-2.5">الرصيد</th>
                          <th className="text-[10px] text-gray-600 font-normal text-right uppercase tracking-widest py-2.5">السعر</th>
                          <th className="text-[10px] text-gray-600 font-normal uppercase tracking-widest py-2.5 text-right pr-4">القيمة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTokens.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-sm text-gray-600 py-12">
                              <div className="text-3xl mb-2 opacity-30">🔍</div>
                              لا توجد رموز مطابقة
                            </td>
                          </tr>
                        ) : (
                          filteredTokens.map((token) => (
                            <TokenRow
                              key={token.address}
                              token={token}
                              selected={selected.has(token.address)}
                              onToggle={() => toggleToken(token.address)}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Refresh */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[11px] text-gray-700">
                    {tokens.length > 0 && `${tokens.length} رمز مكتشف`}
                  </div>
                  <button
                    onClick={refetch}
                    disabled={loading}
                    className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1.5 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    تحديث الأرصدة
                  </button>
                </div>
              </div>

              {/* ─── Side Panel ─────────────────────────────────────────── */}
              <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
                <SweepPanel
                  selectedTokens={selectedTokens}
                  slippageBps={slippageBps}
                  onSlippageChange={setSlippageBps}
                  sweepState={sweepState}
                  onExecute={handleSweep}
                  onReset={handleReset}
                  isConnected={isConnected}
                  onAutoClassify={handleAutoClassify}
                />
                <ReferralCard />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E2028] mt-16 py-6 text-center text-xs text-gray-700">
        <span>CoinBin 🗑️ · مبني على </span>
        <a href="https://base.org" target="_blank" rel="noopener noreferrer" className="text-[#0052FF] hover:underline">Base</a>
        <span> و </span>
        <a href="https://uniswap.org" target="_blank" rel="noopener noreferrer" className="text-[#FF007A] hover:underline">Uniswap V3</a>
        <span> · استخدم بمسؤولية — العملات الرقمية استثمار عالي المخاطر</span>
      </footer>

      {/* ─── Post-Sweep Modal ────────────────────────────────────────────── */}
      {showPostModal && sweepState.status === "success" && (
        <PostSweepModal
          receivedUSDC={sweepState.formattedUserReceives}
          deadTokens={deadTokens}
          sellTxHash={sweepState.sellTxHash}
          onBurnDead={handleBurnDead}
          onClose={() => { setShowPostModal(false); handleReset(); }}
          isBurning={isBurningDead}
        />
      )}
    </div>
  );
}
