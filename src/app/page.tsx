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
import Image from "next/image";
import Link from "next/link";
import { useUI } from "@/context/UIContext";

type FilterType = "all" | "dust" | "nonzero" | "dead";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { t, language, setLanguage, theme, setTheme, isArabic, isLight } = useUI();
  
  const { tokens, loading, error, refetch, totalUSDValue, dustTokens, unpricedTokens } =
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
      const toSelect = tokens.filter(t => (t.usdValue < 1) && t.canSell);
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

  const selectedValue = selectedTokens.reduce((s: number, t) => s + t.usdValue, 0);

  // ─── Toggle handlers ────────────────────────────────────────────────────
  const toggleToken = useCallback((address: string) => {
    setSelected((prev: Set<string>) => {
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
      setSelected((prev: Set<string>) => {
        const next = new Set(prev);
        sellable.forEach((t) => next.delete(t.address));
        return next;
      });
    } else {
      setSelected((prev: Set<string>) => {
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
    if (!walletClient || !address || unpricedTokens.length === 0) return;
    setIsBurningDead(true);
    try {
      const deadQuotes = unpricedTokens.map((t) => ({
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
  }, [walletClient, address, unpricedTokens, refetch]);

  const allSellableSelected =
    filteredTokens.filter((t) => t.canSell).length > 0 &&
    filteredTokens.filter((t) => t.canSell).every((t) => selected.has(t.address));

  return (
    <div className="min-h-screen bg-bg-primary text-white selection:bg-base-blue/30 selection:text-white pb-20">
      <div className="mesh-gradient" />

      {/* ─── Compact Header ────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-bg-surface/60 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20 overflow-hidden relative">
              <Image 
                src="/logo.png" 
                alt="CoinBin" 
                width={40}
                height={40}
                className="w-full h-full object-cover transition-transform group-hover:scale-110" 
              />
            </div>
            <span className="text-xl font-black tracking-tighter text-text-primary">CoinBin</span>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            {/* Toggles Group */}
            <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/5 pr-2">
              <div className="px-3 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Settings ⚙️</div>
               {/* Theme Toggle */}
               <button 
                onClick={() => setTheme(isLight ? 'dark' : 'light')}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all text-lg"
                title={isLight ? "Dark Mode" : "Light Mode"}
              >
                {isLight ? "🌙" : "☀️"}
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              {/* Language Toggle */}
              <button 
                onClick={() => setLanguage(isArabic ? 'en' : 'ar')}
                className="px-3 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all text-[11px] font-black uppercase tracking-widest"
              >
                {isArabic ? "English" : "عربي"}
              </button>
            </div>

            {isConnected && (
              <div className="hidden lg:flex items-center gap-4 text-[11px] font-black uppercase tracking-widest text-text-muted">
                <span>Base Mainnet</span>
              </div>
            )}

            <Wallet>
              <ConnectWallet className="!bg-accent !text-white !rounded-xl !text-[11px] !px-4 !py-2 hover:brightness-110 transition-all font-black uppercase tracking-widest shadow-lg shadow-accent/10">
                <Avatar className="h-5 w-5" />
                <Name className="!text-white" />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address className="text-text-secondary" />
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
            <h1 className="text-5xl md:text-7xl font-black text-text-primary mb-6 leading-tight tracking-tighter">
              {t.subtitle.split(',')[0]}, <span className="text-accent">{t.subtitle.split(',')[1]}</span>
            </h1>
            <p className="text-text-secondary text-lg mb-12 max-w-xl font-medium">
              {t.description}
            </p>
            <Wallet>
              <ConnectWallet className="!bg-accent !text-white !rounded-2xl !text-lg !px-12 !py-6 hover:brightness-110 shadow-2xl shadow-accent/20 active:scale-95 transition-all font-black uppercase tracking-widest" />
            </Wallet>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            <StatsBar
              totalValue={totalUSDValue}
              tokenCount={tokens.filter((t) => t.canSell).length}
              dustCount={dustTokens.length}
              deadCount={unpricedTokens.length}
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
                        allSellableSelected ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-white/5 border-transparent text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {allSellableSelected ? (isArabic ? "إلغاء التحديد" : "Deselect All") : (isArabic ? "تحديد الكل" : "Select All")}
                    </button>
                    {(["all", "dust", "nonzero", "dead"] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all uppercase tracking-widest whitespace-nowrap border ${
                          filter === f
                            ? "bg-accent/10 border-accent/20 text-accent"
                            : "bg-transparent border-transparent text-text-muted hover:text-text-secondary"
                        }`}
                      >
                        {f === "all" ? t.all : 
                         f === "dust" ? `${t.dust} (${dustTokens.length})` : 
                         f === "nonzero" ? t.nonzero : 
                         `${t.dead} (${unpricedTokens.length})`}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t.search}
                      className="w-full text-[11px] font-bold py-2.5 pr-10 pl-4 rounded-xl bg-bg-surface border border-white/5 focus:border-accent/30 outline-none transition-all placeholder:text-text-muted"
                    />
                    <div className={`absolute inset-y-0 ${isArabic ? 'right-3' : 'right-3'} flex items-center text-text-muted`}>
                      🔍
                    </div>
                  </div>
                </div>

                <div className="glass rounded-[2rem] md:rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                  {loading ? (
                    <div className="p-20 md:p-32 text-center">
                      <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">Scanning Wallet...</p>
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div className="py-20 md:py-32 text-center">
                      <p className="text-4xl mb-4">🔍</p>
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">لا توجد عملات مطابقة</p>
                    </div>
                  ) : (
                    <div className="p-3 md:p-6">
                      <div className="hidden md:grid md:grid-cols-[1fr_100px_100px] gap-4 mb-4 px-6 border-b border-white/5 pb-4">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{isArabic ? "الرمز" : "Asset"}</span>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] text-right">{isArabic ? "الرصيد" : "Balance"}</span>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] text-right">{isArabic ? "القيمة" : "Value"}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {filteredTokens.map((token) => (
                          <TokenRow
                            key={token.address}
                            token={token}
                            selected={selected.has(token.address)}
                            onToggle={() => toggleToken(token.address)}
                          />
                        ))}
                      </div>
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
                
                {unpricedTokens.length > 0 && (
                  <div className="glass-card rounded-3xl p-6 border-divider group">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[11px] font-black text-text-muted uppercase tracking-widest">{isArabic ? "لم نجد سعراً محدداً 🔍" : "Unknown Liquidity 🔍"}</h4>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white/5 text-text-muted">{unpricedTokens.length}</span>
                    </div>
                    <p className="text-[10px] text-text-secondary font-bold mb-6 leading-relaxed">
                      {isArabic ? "هذه العملات غير مسعرة في المنصات الكبيرة. جرب استخدام السحب (Sweep) أولاً، فربما يجد النظام سيولة مخفية لها! إذا لم يجد، يمكنك حرقها." : "These assets don't have a public price yet. Try a 'Sweep' check—the system might find hidden liquidity! If no route is found, you can still burn them."}
                    </p>
                    <button 
                      onClick={handleBurnDead}
                      disabled={isBurningDead}
                      className="w-full py-4 rounded-2xl bg-white/5 border border-divider text-text-muted text-[11px] font-black uppercase tracking-widest hover:bg-orange-600/20 hover:text-orange-400 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isBurningDead ? t.burning : `${isArabic ? "حرق جميع العملات غير المسعرة" : "Burn All Unpriced Tokens"} 🔥`}
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
          deadTokens={unpricedTokens}
          sellTxHash={sweepState.sellTxHash}
          onBurnDead={handleBurnDead}
          onClose={() => { setShowPostModal(false); handleReset(); }}
          isBurning={isBurningDead}
        />
      )}
    </div>
  );
}
