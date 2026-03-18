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
    <div className="min-h-screen bg-bg-primary text-white selection:bg-base-blue/30 selection:text-white">
      <div className="mesh-gradient" />

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="w-11 h-11 rounded-2xl bg-base-blue flex items-center justify-center shadow-[0_0_20px_rgba(0,82,255,0.3)] group-hover:scale-110 transition-transform duration-500">
              <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="8" fill="white" opacity="0.15" />
                <path d="M9 2C5.134 2 2 5.134 2 9C2 12.866 5.134 16 9 16C12.866 16 16 12.866 16 9C16 5.134 12.866 2 9 2ZM9 14C6.243 14 4 11.757 4 9C4 6.243 6.243 4 9 4C11.757 4 14 6.243 14 9C14 11.757 11.757 14 9 14Z" fill="white" />
                <circle cx="9" cy="9" r="2.5" fill="white" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <div className="text-xl font-black tracking-tighter text-white leading-none">CoinBin <span className="text-base-blue">🗑️</span></div>
              <div className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Base Cleaner</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Base Network</span>
            </div>
            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/5 bg-white/[0.02] text-[11px] font-bold text-slate-400 hover:text-white hover:border-white/10 hover:bg-white/[0.05] transition-all"
            >
              📊 DASHBOARD
            </Link>

            <div className="h-8 w-[1px] bg-white/5 mx-2" />

            <Wallet>
              <ConnectWallet className="!bg-base-blue !text-white !rounded-2xl !text-sm !px-6 !py-2.5 hover:!bg-[#0041CC] transition-all font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,82,255,0.2)]">
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address className="text-slate-400" />
                  <EthBalance />
                </Identity>
                <WalletDropdownDisconnect className="text-red-400 hover:bg-red-500/10" />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {!isConnected ? (
          /* ─── Hero / Not Connected ────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-base-blue/5 border border-base-blue/10 text-[11px] font-black text-base-blue uppercase tracking-[0.2em] mb-8">
              ✨ THE #1 BASE SWEEPER
            </div>

            <h1 className="text-6xl md:text-7xl font-black text-white mb-6 leading-[0.9] tracking-tighter">
              نظّف محفظتك <br />
              <span className="text-gradient">واستلم USDC</span>
            </h1>
            
            <p className="text-slate-500 text-lg mb-12 max-w-xl leading-relaxed font-medium">
              اكتشف جميع توكناتك على شبكة Base بضغطة واحدة. بيع العملات دفعة واحدة بأفضل الأسعار المباشرة، أو احرق العملات الميتة لتنظيف محفظتك تماماً.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
              <Wallet>
                <ConnectWallet className="!bg-base-blue !text-white !rounded-2xl !text-lg !px-12 !py-6 hover:!bg-[#0041CC] transition-all font-black uppercase tracking-widest shadow-[0_0_40px_rgba(0,82,255,0.35)] active:scale-95">
                  <span>ربط المحفظة للبدء</span>
                </ConnectWallet>
              </Wallet>
              <Link href="https://docs.base.org" target="_blank" className="px-10 py-5 rounded-2xl bg-white/[0.03] border border-white/5 font-black text-sm text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all uppercase tracking-widest">
                كيف يعمل؟
              </Link>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
              {[
                { icon: "⚡", title: "اكتشاف فوري", desc: "فحص شامل لمحفظتك بحثاً عن أي عملات" },
                { icon: "💎", title: "أسعار حقيقية", desc: "ربط مباشر مع GeckoTerminal وUniswap" },
                { icon: "🔒", title: "آمن وشفاف", desc: "تحكم كامل في موافقات العملات قبل البيع" },
              ].map((f, i) => (
                <div key={i} className="glass-card rounded-3xl p-8 text-center group">
                  <div className="text-4xl mb-4 group-hover:scale-125 transition-transform duration-500">{f.icon}</div>
                  <div className="text-sm font-black text-white mb-2 uppercase tracking-wide">{f.title}</div>
                  <div className="text-xs font-medium text-slate-500 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
            
            <div className="mt-16 pt-8 border-t border-white/5 w-full max-w-lg flex items-center justify-around opacity-40">
              <img src="https://avatars.githubusercontent.com/u/108554348?v=4" className="h-6 grayscale hover:grayscale-0 transition-all" alt="Base" title="Built on Base" />
              <img src="https://uniswap.org/favicon.png" className="h-6 grayscale hover:grayscale-0 transition-all" alt="Uniswap" title="Powered by Uniswap" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verified Contracts</span>
            </div>
          </div>
        ) : (
          /* ─── Dashboard ───────────────────────────────────── */
          <div className="animate-fade-in">
            <StatsBar
              totalValue={totalUSDValue}
              tokenCount={tokens.filter((t) => t.canSell).length}
              dustCount={dustTokens.length}
              deadCount={deadTokens.length}
              selectedCount={selectedTokens.length}
              selectedValue={selectedValue}
              loading={loading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
              {/* ─── Token List ─────────────────────────────────────────── */}
              <div className="min-w-0">
                {/* Search and Filters Header */}
                <div className="glass-card rounded-3xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between border-white/[0.03]">
                  <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar pb-2 md:pb-0">
                    <button
                      onClick={toggleAll}
                      className={`text-[11px] font-black px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap uppercase tracking-widest ${
                        allSellableSelected ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/[0.03] border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                      }`}
                    >
                      {allSellableSelected ? "إلغاء التحديد" : "تحديد الكل"}
                    </button>
                    <div className="w-[1px] h-6 bg-white/5 mx-1" />
                    {(["all", "dust", "nonzero", "dead"] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-[11px] font-black px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap uppercase tracking-widest ${
                          filter === f
                            ? "bg-base-blue/10 border-base-blue/20 text-base-blue glow-accent"
                            : "bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {f === "all" ? "الكل" : f === "dust" ? `غبار (${dustTokens.length})` : f === "nonzero" ? "أرصدة" : `ميت 🔥 (${deadTokens.length})`}
                      </button>
                    ))}
                  </div>
                  
                  <div className="relative w-full md:w-64 group">
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-600 group-focus-within:text-base-blue transition-colors">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="بحث عن رمز..."
                      className="w-full text-xs font-bold py-3 pr-10 pl-4 rounded-xl glass-card border-white/5 bg-transparent focus:outline-none focus:border-base-blue/30 transition-all placeholder:text-slate-700"
                    />
                  </div>
                </div>

                {/* Table Container */}
                <div className="glass rounded-[2rem] border border-white/10 overflow-hidden glow-accent/5">
                  {error ? (
                    <div className="p-16 text-center space-y-4">
                      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-red-500/20">⚠️</div>
                      <div className="space-y-1">
                        <div className="text-sm font-black text-white uppercase tracking-wider">خطأ في مزامنة البيانات</div>
                        <div className="text-xs text-slate-500 max-w-xs mx-auto break-words">{error}</div>
                      </div>
                      <button onClick={refetch} className="px-6 py-2.5 rounded-xl bg-base-blue/10 text-base-blue font-black text-[11px] uppercase tracking-widest hover:bg-base-blue/20 transition-all">
                        إعادة المحاولة
                      </button>
                    </div>
                  ) : loading ? (
                    <div className="p-20 text-center space-y-6">
                      <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                        <div className="absolute inset-0 border-4 border-base-blue rounded-full border-t-transparent animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-black text-white uppercase tracking-widest animate-pulse">Scanning Base...</div>
                        <div className="text-[11px] font-bold text-slate-600">نقوم بفحص جميع محافظ الهوية والتوكنات الخاصة بك</div>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.01]">
                            <th className="w-12 pl-6 py-4" />
                            <th className="text-[10px] font-black text-slate-500 text-right uppercase tracking-[0.2em] py-4 pr-3">الرمز</th>
                            <th className="text-[10px] font-black text-slate-500 text-right uppercase tracking-[0.2em] py-4">الرصيد</th>
                            <th className="text-[10px] font-black text-slate-500 text-right uppercase tracking-[0.2em] py-4">السعر المباشر</th>
                            <th className="text-[10px] font-black text-slate-500 text-right uppercase tracking-[0.2em] py-4 pr-6">القيمة التقريبية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {filteredTokens.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-24 text-center opacity-40">
                                <div className="text-5xl mb-4">🔍</div>
                                <div className="text-xs font-black uppercase tracking-widest">لا توجد نتائج</div>
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
                    </div>
                  )}
                </div>

                {/* Footer Stats/Actions */}
                <div className="mt-6 flex items-center justify-between px-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 opacity-60">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tokens.length} عملة مكتشفة</span>
                    </div>
                    {selected.size > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-base-blue animate-pulse" />
                        <span className="text-[10px] font-black text-base-blue uppercase tracking-widest">{selected.size} محدد</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={refetch}
                    disabled={loading}
                    className="flex items-center gap-2 group text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                  >
                    <svg className={`group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    تحديث القائمة
                  </button>
                </div>
              </div>

              {/* ─── Sidebar ─────────────────────────────────────────── */}
              <aside className="space-y-6">
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

                <div className="glass-card rounded-3xl p-6 border-white/[0.03]">
                  <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">💡 تعليمات سريعة</h4>
                  <ul className="space-y-3">
                    {[
                      "اختر العملات التي تريد بيعها من القائمة",
                      "سيتم فحص السيولة تلقائياً لكل عملة",
                      "تأكد من الموافقة على كل عملة في محفظتك",
                      "العملات بدون سيولة ستوجّه تلقائياً للحرق"
                    ].map((step, i) => (
                      <li key={i} className="flex gap-3 text-[11px] font-bold text-slate-500 leading-tight">
                        <span className="text-base-blue opacity-50">{i+1}.</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/40 backdrop-blur-xl py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="text-sm font-black text-white uppercase tracking-tighter">CoinBin <span className="text-base-blue">🗑️</span></div>
             <div className="w-[1px] h-4 bg-white/10" />
             <div className="text-[10px] font-bold text-slate-600">The first multi-token sweeper for Base</div>
          </div>
          
          <div className="flex items-center gap-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <a href="https://base.org" className="hover:text-base-blue transition-colors">Base Ecosystem</a>
            <a href="https://uniswap.org" className="hover:text-[#FF007A] transition-colors">Uniswap V3</a>
          </div>
          
          <div className="text-[9px] font-bold text-slate-700 max-w-[200px] text-center md:text-left leading-relaxed">
            استخدم بمسؤولية. لا نقوم بتخزين أي مفاتيح خاصة. جميع المعاملات تتم عبر عقود ذكية مفتوحة المصدر.
          </div>
        </div>
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
