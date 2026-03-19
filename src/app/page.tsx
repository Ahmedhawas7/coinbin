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
            {/* Settings Toggles */}
            <div className="flex items-center gap-2 p-1.5 bg-bg-elevated/50 rounded-[1.25rem] border border-divider">
               <div className="hidden sm:block px-3 text-[9px] font-black text-text-muted uppercase tracking-[0.2em] opacity-50">Settings</div>
               
               {/* Theme Toggle */}
               <button 
                onClick={() => setTheme(isLight ? 'dark' : 'light')}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all text-lg shadow-sm"
                title={isLight ? "Dark Mode" : "Light Mode"}
              >
                {isLight ? "🌙" : "☀️"}
              </button>

              <div className="w-[1px] h-4 bg-divider mx-1" />

              {/* Language Toggle */}
              <button 
                onClick={() => setLanguage(isArabic ? 'en' : 'ar')}
                className="px-4 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all text-[11px] font-black uppercase tracking-widest text-text-secondary"
              >
                {isArabic ? "EN" : "AR"}
              </button>
            </div>

            {isConnected && (
              <div className="hidden lg:flex items-center gap-4 text-[11px] font-black uppercase tracking-widest text-text-muted">
                <span>Base Mainnet</span>
              </div>
            )}

            <Wallet>
              <ConnectWallet className="!bg-accent !text-white !rounded-xl !text-[11px] !px-5 !py-3 hover:scale-105 active:scale-95 transition-all font-black uppercase tracking-widest shadow-xl shadow-accent/20 border-0">
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
          <div className="flex flex-col items-center justify-center py-24 md:py-40 text-center animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <h1 className="text-6xl md:text-8xl font-black text-text-primary mb-8 leading-[0.9] tracking-tighter">
              {t.subtitle.split(',')[0]}<br/>
              <span className="text-accent italic font-black">{t.subtitle.split(',')[1]}</span>
            </h1>
            <p className="text-text-secondary text-lg md:text-xl mb-12 max-w-2xl font-medium leading-relaxed">
              {t.description}
            </p>
            <Wallet>
              <ConnectWallet className="v-btn-primary !text-lg !px-16 !py-8 shadow-2xl scale-110 hover:scale-115" />
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
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between v-glass rounded-[2rem] p-2 backdrop-blur-3xl shadow-xl">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto p-1 pl-4">
                    <button
                      onClick={toggleAll}
                      className={`text-[9.5px] font-black px-5 py-3 rounded-[1.25rem] transition-all uppercase tracking-[0.2em] ${
                        allSellableSelected ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {allSellableSelected ? (isArabic ? "إلغاء الكل" : "Reset") : (isArabic ? "تحديد الكل" : "Select All")}
                    </button>
                    {(["all", "dust", "nonzero", "dead"] as FilterType[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-[9.5px] font-black px-5 py-3 rounded-[1.25rem] transition-all uppercase tracking-[0.2em] whitespace-nowrap ${
                          filter === f
                            ? "bg-accent text-white shadow-lg shadow-accent/20"
                            : "bg-transparent text-text-muted hover:text-text-secondary"
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
                      className="w-full text-xs font-bold py-4 pr-12 pl-6 rounded-[1.5rem] bg-bg-elevated border-0 focus:ring-2 focus:ring-accent/50 outline-none transition-all placeholder:text-text-muted text-text-primary"
                    />
                    <div className="absolute inset-y-0 right-8 flex items-center text-text-muted opacity-50">
                      🔍
                    </div>
                  </div>
                </div>

                <div className="v-glass rounded-[2.5rem] p-1 md:p-3 shadow-2xl overflow-hidden border-divider">
                  {loading ? (
                    <div className="py-24 md:py-40 text-center flex flex-col items-center">
                      <div className="w-16 h-16 border-[6px] border-accent/10 border-t-accent rounded-full animate-spin mb-6" />
                      <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.4em] animate-pulse">Scanning Base Protocol...</p>
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div className="py-24 md:py-40 text-center flex flex-col items-center">
                      <span className="text-6xl mb-6 grayscale opacity-20">🕳️</span>
                      <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em]">{isArabic ? "لا توجد نتائج" : "No Assets Found"}</p>
                    </div>
                  ) : (
                    <div className="p-2 md:p-6">
                      <div className="hidden md:grid md:grid-cols-[1fr_120px_120px] gap-6 mb-6 px-8 border-b border-divider pb-6">
                        <span className="v-stat-label">{isArabic ? "الرمز" : "Asset"}</span>
                        <span className="v-stat-label text-right">{isArabic ? "الرصيد" : "Balance"}</span>
                        <span className="v-stat-label text-right">{isArabic ? "القيمة" : "Value"}</span>
                      </div>
                      <div className="flex flex-col gap-2">
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
                  <div className="v-card rounded-[2rem] p-8 border-divider relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-orange-500/10 transition-colors" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="v-stat-label !text-orange-500">{isArabic ? "سيولة مخفية 🔍" : "Hidden Liquidity 🔍"}</h4>
                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">{unpricedTokens.length}</span>
                      </div>
                      <p className="text-[11px] text-text-secondary font-semibold mb-8 leading-relaxed opacity-80">
                        {isArabic ? "هذه العملات غير مسعرة في المنصات الكبيرة. جرب استخدام 'Sweep' أولاً للفحص العميق، إذا لم يظهر سعر، يمكنك الحرق لتنظيف المحفظة." : "These assets are not indexed by major APIs. Try a 'Sweep' scan first—we'll check Aerodrome/Uniswap directly. If no route exists, you can burn to clean your wallet."}
                      </p>
                      <button 
                        onClick={handleBurnDead}
                        disabled={isBurningDead}
                        className="w-full py-5 rounded-2xl bg-bg-main border border-divider text-text-muted text-[11px] font-black uppercase tracking-[0.2em] hover:bg-orange-600 transition-all hover:text-white active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        {isBurningDead ? t.burning : `${isArabic ? "حرق العملات غير المسعرة" : "Burn Unpriced Assets"} 🔥`}
                      </button>
                    </div>
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
