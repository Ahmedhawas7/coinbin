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
import { PostSweepModal } from "@/components/PostSweepModal";
import { saveReferrer, getReferrerFromURL, getActiveReferrer } from "@/lib/referral";
import { executeBurn } from "@/lib/sweep";
import { useWalletClient } from "wagmi";
import Link from "next/link";

type FilterType = "all" | "dust" | "nonzero" | "dead";

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
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

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

  // AUTO-SELECT DUST AND DEAD TOKENS ON FIRST LOAD
  useEffect(() => {
    if (!loading && tokens.length > 0 && !hasAutoSelected && isConnected) {
      const toSelect = tokens.filter(t => (t.usdValue < 1 || t.usdValue === 0) && t.canSell);
      if (toSelect.length > 0) {
        setSelected(new Set(toSelect.map(t => t.address)));
      }
      setHasAutoSelected(true);
    }
  }, [loading, tokens, hasAutoSelected, isConnected]);

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
      await classify(tokensToProcess, slippageBps, referrer as `0x${string}`);
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
    } catch { /* ignore */ }
    finally { setIsBurningDead(false); }
  }, [walletClient, address, deadTokens, refetch]);

  const allSellableSelected =
    filteredTokens.filter((t) => t.canSell).length > 0 &&
    filteredTokens.filter((t) => t.canSell).every((t) => selected.has(t.address));

  return (
    <div className="min-h-screen bg-bg-primary text-white selection:bg-base-blue/30 selection:text-white pb-20">
      <div className="mesh-gradient" />

      {/* ─── Compact Header ────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-black/60 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-8 h-8 rounded-xl bg-base-blue flex items-center justify-center shadow-lg shadow-base-blue/20">
              🗑️
            </div>
            <span className="text-lg font-black tracking-tighter text-white">CoinBin</span>
          </div>

          <div className="flex items-center gap-6">
            {isConnected && (
              <div className="hidden md:flex items-center gap-4 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Link href="/dashboard" className="hover:text-base-blue transition-colors">Analytics</Link>
                <div className="w-[1px] h-3 bg-white/10" />
                <span>Base Mainnet</span>
              </div>
            )}
            <Wallet>
              <ConnectWallet className="!bg-base-blue !text-white !rounded-xl !text-[11px] !px-4 !py-2 hover:!bg-[#0041CC] transition-all font-black uppercase tracking-widest shadow-lg shadow-base-blue/10">
                <Avatar className="h-5 w-5" />
                <Name className="!text-white" />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address className="text-slate-400" />
                </Identity>
                <WalletDropdownDisconnect className="text-red-400 hover:bg-red-500/10" />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tighter">
              نظّف محفظتك واستلم <span className="text-base-blue">USDC</span>
            </h1>
            <p className="text-slate-500 text-lg mb-12 max-w-xl font-medium">
              الخيار الأول في Base لبيع وحرق العملات الميتة بضغطة واحدة.
            </p>
            <Wallet>
              <ConnectWallet className="!bg-base-blue !text-white !rounded-2xl !text-lg !px-12 !py-6 hover:!bg-base-blue/90 shadow-2xl shadow-base-blue/20 active:scale-95 transition-all font-black uppercase tracking-widest" />
            </Wallet>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <StatsBar
              totalValue={totalUSDValue}
              tokenCount={tokens.filter((t) => t.canSell).length}
              dustCount={dustTokens.length}
              deadCount={deadTokens.length}
              selectedCount={selectedTokens.length}
              selectedValue={selectedValue}
              loading={loading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
              {/* Token List Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/[0.02] border border-white/5 rounded-[2rem] p-3 backdrop-blur-md">
                   <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto p-1">
                    <button
                      onClick={toggleAll}
                      className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all uppercase tracking-widest border ${
                        allSellableSelected ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-white/5 border-transparent text-slate-400 hover:text-white"
                      }`}
                    >
                      {allSellableSelected ? "إلغاء التحديد" : "تحديد الكل"}
                    </button>
                    {(["all", "dust", "nonzero", "dead"] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all uppercase tracking-widest whitespace-nowrap border ${
                          filter === f
                            ? "bg-base-blue/10 border-base-blue/20 text-base-blue"
                            : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {f === "all" ? "الكل" : f === "dust" ? `غبار (${dustTokens.length})` : f === "nonzero" ? "أرصدة" : `ميت (${deadTokens.length})`}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="بحث..."
                      className="w-full text-[11px] font-bold py-2.5 pr-10 pl-4 rounded-xl bg-black/20 border border-white/5 focus:border-base-blue/30 outline-none transition-all placeholder:text-slate-700"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center text-slate-700">
                      🔍
                    </div>
                  </div>
                </div>

                <div className="glass rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                  {loading ? (
                    <div className="p-32 text-center">
                      <div className="w-12 h-12 border-4 border-base-blue/20 border-t-base-blue rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Scanning Wallet...</p>
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div className="py-32 text-center">
                      <p className="text-4xl mb-4">🔍</p>
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">لا توجد عملات مطابقة</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-white/[0.02] border-b border-white/5">
                            <th className="w-14 pl-6 py-5" />
                            <th className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] py-5">الرمز</th>
                            <th className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] py-5">الرصيد</th>
                            <th className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] py-5">القيمة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                          {filteredTokens.map((token) => (
                            <TokenRow
                              key={token.address}
                              token={token}
                              selected={selected.has(token.address)}
                              onToggle={() => toggleToken(token.address)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Panel */}
              <aside className="sticky top-24 space-y-6">
                <SweepPanel
                  selectedTokens={selectedTokens}
                  slippageBps={slippageBps}
                  onSlippageChange={setSlippageBps}
                  sweepState={sweepState}
                  onExecute={handleSweep}
                  onReset={handleReset}
                  isConnected={isConnected}
                />
                
                {deadTokens.length > 0 && (
                  <div className="glass-card rounded-3xl p-6 border-orange-500/10 group">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[11px] font-black text-orange-500 uppercase tracking-widest">تحذير من عملات ميتة 🔥</h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">{deadTokens.length}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold mb-6 leading-relaxed">
                      هذه العملات ليس لها سيولة حالياً. يمكنك التخلص منها تماماً لتنظيف محفظتك.
                    </p>
                    <button 
                      onClick={handleBurnDead}
                      disabled={isBurningDead}
                      className="w-full py-4 rounded-2xl bg-orange-600/10 border border-orange-500/20 text-orange-500 text-[11px] font-black uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isBurningDead ? "جارٍ الحرق..." : "حرق جميع العملات الميتة 🔥"}
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* Post Sweep Modal */}
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
