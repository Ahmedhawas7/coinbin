// src/app/page.tsx
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
} from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useSweep } from "@/hooks/useSweep";
import { TokenRow } from "@/components/TokenRow";
import { SweepPanel } from "@/components/SweepPanel";
import { StatsBar } from "@/components/StatsBar";
import { PostSweepModal } from "@/components/PostSweepModal";
import { saveReferrer, getReferrerFromURL, getActiveReferrer } from "@/lib/referral";
import Image from "next/image";
import Link from "next/link";
import { useUI } from "@/context/UIContext";

type FilterType = "all" | "dust" | "nonzero" | "dead";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const { t, isArabic, isLight, setTheme, setLanguage } = useUI();
  
  const { tokens, loading, error, refetch, totalUSDValue, dustTokens, unpricedTokens } =
    useTokenBalances();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [showPostModal, setShowPostModal] = useState(false);
  const [isBurningDead, setIsBurningDead] = useState(false);

  const { state: sweepState, scan, startCleaning, reset } = useSweep();

  // Read referrer from URL on mount
  useEffect(() => {
    const urlRef = getReferrerFromURL();
    if (urlRef) saveReferrer(urlRef);
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
          t.address.toLowerCase().includes(q)
      );
    }
    if (filter === "dust")   list = list.filter((t) => t.usdValue > 0 && t.usdValue < 1);
    if (filter === "nonzero") list = list.filter((t) => t.usdValue > 0);
    if (filter === "dead")   list = list.filter((t) => t.status === "NO_LIQUIDITY" || t.status === "DEAD");
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
    if (sweepState.status !== "idle") reset();
  }, [sweepState.status, reset]);

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
    if (sweepState.status !== "idle") reset();
  }, [filteredTokens, selected, sweepState.status, reset]);

  // ─── Execute sweep ───────────────────────────────────────────────────────
  const handleSweep = useCallback(async () => {
    if (sweepState.status === "error" || sweepState.status === "success") { reset(); return; }
    
    if (sweepState.swaps.length === 0) {
       await scan(selectedTokens.map(t => t.address));
       return;
    }
    
    await startCleaning(selectedTokens, slippageBps);
  }, [selectedTokens, slippageBps, scan, startCleaning, sweepState, reset]);

  const handleBurnDead = useCallback(async () => {
    if (unpricedTokens.length === 0) return;
    setIsBurningDead(true);
    try {
      await startCleaning(unpricedTokens, 0);
      await refetch();
    } catch { /* ignore */ }
    finally { setIsBurningDead(false); }
  }, [unpricedTokens, startCleaning, refetch]);

  const handleReset = useCallback(() => {
    reset();
    setSelected(new Set());
    setShowPostModal(false);
    refetch();
  }, [reset, refetch]);

  const allSellableSelected =
    filteredTokens.filter((t) => t.canSell).length > 0 &&
    filteredTokens.filter((t) => t.canSell).every((t) => selected.has(t.address));

  return (
    <div className={`min-h-screen bg-bg-main text-text-primary selection:bg-accent selection:text-white transition-colors duration-500`}>
      <div className="mesh-gradient" />

      {/* ─── Compact Header ────────────────────────────────────────────── */}
      <header className="v-glass sticky top-0 z-40 border-b-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-xl shadow-accent/20 overflow-hidden relative">
              <Image 
                src="/logo.png" 
                alt="CoinBin" 
                width={48}
                height={48}
                className="w-full h-full object-cover transition-transform group-hover:scale-110" 
              />
            </div>
            <div className="flex flex-col -gap-1">
              <span className="text-2xl font-black tracking-tighter text-text-primary font-heading uppercase">CoinBin</span>
              <span className="text-[9px] font-black text-accent tracking-[0.3em] uppercase ml-0.5">Base Cleaner</span>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center gap-2 p-1.5 bg-bg-elevated/50 rounded-[1.25rem] border border-divider">
               <button 
                onClick={() => setTheme(isLight ? 'dark' : 'light')}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all text-lg"
              >
                {isLight ? "🌙" : "☀️"}
              </button>
              <button 
                onClick={() => setLanguage(isArabic ? 'en' : 'ar')}
                className="px-4 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all text-[11px] font-black uppercase tracking-widest text-text-secondary"
              >
                {isArabic ? "EN" : "AR"}
              </button>
            </div>

            <Wallet>
              <ConnectWallet className="!bg-accent !text-white !rounded-xl !text-[11px] !px-5 !py-3 hover:scale-105 transition-all font-black uppercase tracking-widest border-0">
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
          <div className="flex flex-col items-center justify-center py-24 md:py-40 text-center">
            <h1 className="text-6xl md:text-8xl font-black text-text-primary mb-8 leading-[0.9] tracking-tighter">
              {t.subtitle.split(',')[0]}<br/>
              <span className="text-accent italic font-black">{t.subtitle.split(',')[1]}</span>
            </h1>
            <p className="text-text-secondary text-lg mb-12 max-w-2xl font-medium">
              {t.description}
            </p>
            <Wallet>
              <ConnectWallet className="v-btn-primary !text-lg !px-16 !py-8 shadow-2xl scale-110" />
            </Wallet>
          </div>
        ) : (
          <div className="space-y-8">
            <StatsBar
              totalValue={totalUSDValue}
              tokenCount={tokens.length}
              dustCount={dustTokens.length}
              deadCount={unpricedTokens.length}
              selectedCount={selectedTokens.length}
              selectedValue={selectedValue}
              loading={loading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between v-glass rounded-[2rem] p-2">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto p-1 pl-4">
                    <button
                      onClick={toggleAll}
                      className={`text-[9.5px] font-black px-5 py-3 rounded-[1.25rem] transition-all uppercase tracking-[0.2em] ${
                        allSellableSelected ? "bg-red-500 text-white" : "bg-bg-elevated text-text-secondary"
                      }`}
                    >
                      {allSellableSelected ? (isArabic ? "إلغاء الكل" : "Reset") : (isArabic ? "تحديد الكل" : "Select All")}
                    </button>
                    {(["all", "dust", "nonzero", "dead"] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-[9.5px] font-black px-5 py-3 rounded-[1.25rem] transition-all uppercase tracking-[0.2em] whitespace-nowrap ${
                          filter === f ? "bg-accent text-white" : "bg-transparent text-text-muted"
                        }`}
                      >
                        {f === "all" ? t.all : 
                         f === "dust" ? `${t.dust} (${dustTokens.length})` : 
                         f === "nonzero" ? t.nonzero : 
                         `${t.dead} (${unpricedTokens.length})`}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-72 sm:pr-2">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t.search}
                      className="w-full text-xs font-bold py-4 pr-12 pl-6 rounded-[1.5rem] bg-bg-elevated border-0 outline-none transition-all placeholder:text-text-muted"
                    />
                  </div>
                </div>

                <div className="v-glass rounded-[2.5rem] p-1 md:p-3 shadow-2xl overflow-hidden">
                  {loading ? (
                    <div className="py-24 text-center">
                      <div className="w-12 h-12 border-4 border-accent/10 border-t-accent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Scanning Liquidity...</p>
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div className="py-24 text-center">
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">No Assets Found</p>
                    </div>
                  ) : (
                    <div className="p-2 md:p-6 flex flex-col gap-2">
                       {filteredTokens.map((token) => (
                          <TokenRow
                            key={token.address}
                            token={token}
                            selected={selected.has(token.address)}
                            onToggle={() => toggleToken(token.address)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <aside className="sticky top-24">
                <SweepPanel
                  selectedTokens={selectedTokens}
                  slippageBps={slippageBps}
                  onSlippageChange={setSlippageBps}
                  sweepState={sweepState}
                  onExecute={handleSweep}
                  onReset={reset}
                  isConnected={isConnected}
                />
              </aside>
            </div>
          </div>
        )}
      </main>

      {showPostModal && sweepState.status === "success" && (
        <PostSweepModal
          receivedUSDC={sweepState.formattedUserReceives}
          deadTokens={unpricedTokens}
          onClose={() => { setShowPostModal(false); handleReset(); }}
          onBurnDead={handleBurnDead}
          isBurning={isBurningDead}
          sellTxHash={sweepState.sellTxHash}
          burnTxHashes={sweepState.burnTxHashes}
        />
      )}
    </div>
  );
}
