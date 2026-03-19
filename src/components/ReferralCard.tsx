"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  generateReferralLink,
  getReferralStats,
  getActiveReferrer,
  saveReferrer,
  getReferrerFromURL,
  REFERRAL_FEE_SHARE,
} from "@/lib/referral";
import { useUI } from "@/context/UIContext";

export function ReferralCard() {
  const { isArabic, isLight, t } = useUI();
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [stats, setStats] = useState({ totalReferred: 0, totalEarnedUSD: 0, lastActivity: "" });
  const [activeReferrer, setActiveReferrer] = useState<string | null>(null);

  useEffect(() => {
    const urlRef = getReferrerFromURL();
    if (urlRef) {
      saveReferrer(urlRef);
      setActiveReferrer(urlRef);
    } else {
      setActiveReferrer(getActiveReferrer());
    }
  }, []);

  useEffect(() => {
    if (!address) return;
    setReferralLink(generateReferralLink(address));
    setStats(getReferralStats(address));
  }, [address]);

  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isConnected) return null;

  const shareText = encodeURIComponent(
    isArabic
      ? `🗑️ CoinBin — نظّف محفظتك على Base!\nبيع جميع رموزك الغبار → USDC بضغطة واحدة 💰\n\n${referralLink}`
      : `🗑️ CoinBin — Clean your Base wallet!\nSell all dust tokens → USDC in one click 💰\n\n${referralLink}`
  );

  return (
    <div className="rounded-2xl border border-divider bg-bg-surface overflow-hidden shadow-xl">
      {/* Header */}
      <div className={`px-5 py-3.5 border-b border-divider flex items-center justify-between ${isLight ? "bg-bg-surface" : "bg-gradient-to-r from-bg-surface to-bg-surface/80"}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔗</span>
          <span className="text-sm font-semibold text-text-primary">{isArabic ? "نظام الإحالة" : "Referral Program"}</span>
        </div>
        <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
          {REFERRAL_FEE_SHARE}% {isArabic ? "عمولة" : "Commission"}
        </span>
      </div>

      <div className="p-5 space-y-4">

        {/* كيف يعمل */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: "🔗", label: isArabic ? "شارك رابطك" : "Share Link" },
            { icon: "👥", label: isArabic ? "يستخدمون CoinBin" : "Friends Join" },
            { icon: "💰", label: isArabic ? "تربح 20% دائماً" : "Earn 20% Forever" },
          ].map((s, i) => (
            <div key={i} className="bg-bg-surface rounded-xl p-2.5 text-center border border-divider">
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-[10px] text-text-muted leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-text-muted leading-relaxed text-center">
          {isArabic ? "كل مستخدم ينضم عبر رابطك" : "Every user joining via your link"} ←{" "}
          <span className="text-amber-400 font-semibold">{REFERRAL_FEE_SHARE}%</span>{" "}
          {isArabic ? "من رسوم كل صفقاته تصل إليك تلقائياً وإلى الأبد 🎉" : "of their trade fees sent to you automatically forever 🎉"}
        </p>

        {/* رابط الإحالة */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-text-muted uppercase tracking-widest">{isArabic ? "رابطك الفريد" : "Your Unique Link"}</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-bg-surface border border-divider rounded-lg px-3 py-2 font-mono text-[10px] text-text-muted truncate">
              {referralLink || (isArabic ? "ربط محفظتك أولاً..." : "Connect wallet first...")}
            </div>
            <button
              onClick={copyLink}
              disabled={!referralLink}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
               copied
                  ? "bg-emerald-600 text-white"
                  : "bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20"
              }`}
            >
              {copied ? (isArabic ? "✓ تم" : "✓ Copied") : (isArabic ? "نسخ" : "Copy")}
            </button>
          </div>
        </div>

        {/* مشاركة سريعة */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-text-muted uppercase tracking-widest">{isArabic ? "مشاركة سريعة" : "Quick Share"}</div>
          <div className="grid grid-cols-3 gap-2">
            {/* X / Twitter */}
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-divider text-[10px] text-text-muted hover:border-divider hover:text-text-primary transition-all hover:bg-accent/5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Twitter
            </a>
            {/* Telegram */}
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(isArabic ? "🗑️ CoinBin — نظّف محفظتك على Base! بيع رموزك → USDC بضغطة واحدة" : "🗑️ CoinBin — Clean your Base wallet! Sell tokens → USDC in one click")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-divider text-[10px] text-text-muted hover:border-divider hover:text-text-primary transition-all hover:bg-accent/5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Telegram
            </a>
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-divider text-[10px] text-text-muted hover:border-divider hover:text-text-primary transition-all hover:bg-accent/5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-divider">
          <div className="bg-bg-surface rounded-xl p-3 border border-divider">
            <div className="text-[10px] text-text-muted mb-1">{isArabic ? "المُحالون" : "Referred"}</div>
            <div className="text-xl font-bold text-text-primary">{stats.totalReferred}</div>
          </div>
          <div className="bg-bg-surface rounded-xl p-3 border border-amber-900/20">
            <div className="text-[10px] text-text-muted mb-1">{isArabic ? "أرباحك (USDC)" : "Earnings (USDC)"}</div>
            <div className="text-xl font-bold text-amber-400">
              ${stats.totalEarnedUSD.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Referrer notice */}
        {activeReferrer && activeReferrer.toLowerCase() !== address?.toLowerCase() && (
          <div className="text-[10px] text-text-muted flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-900/20 rounded-lg px-3 py-2">
            <span className="text-emerald-500">✓</span>
            <span>
              {isArabic ? "انضممت عبر:" : "Joined via:"}{" "}
              <span className="font-mono text-text-muted opacity-70">
                {activeReferrer.slice(0, 6)}...{activeReferrer.slice(-4)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
