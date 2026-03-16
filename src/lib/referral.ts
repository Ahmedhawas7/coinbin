// src/lib/referral.ts — CoinBin Referral System
//
// كيف يعمل؟
// - كل مستخدم يحصل على رابط فريد: coinbin.app/?ref=0xABCD
// - لما يأتي مستخدم جديد عبر الرابط → نحفظ المُحيل في localStorage
// - عند تنفيذ sweep → 20% من رسوم CoinBin تذهب للمُحيل تلقائياً
// - الباقي (80%) يذهب لمحفظة CoinBin الرئيسية

export const REFERRAL_FEE_SHARE = 20; // 20% من رسوم البروتوكول للمُحيل
export const REFERRAL_PARAM = "ref";
export const REFERRAL_STORAGE_KEY = "coinbin_referrer";

// ─── قراءة المُحيل من URL ─────────────────────────────────────────────────

export function getReferrerFromURL(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get(REFERRAL_PARAM);
  if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) return ref;
  return null;
}

// ─── حفظ المُحيل ─────────────────────────────────────────────────────────

export function saveReferrer(address: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFERRAL_STORAGE_KEY, address);
}

// ─── قراءة المُحيل المحفوظ ───────────────────────────────────────────────

export function getSavedReferrer(): string | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (saved && /^0x[0-9a-fA-F]{40}$/.test(saved)) return saved;
  return null;
}

// ─── تحديد المُحيل الفعال (URL يأخذ أولوية على المحفوظ) ─────────────────

export function getActiveReferrer(): string | null {
  return getReferrerFromURL() ?? getSavedReferrer();
}

// ─── توليد رابط الإحالة للمستخدم ─────────────────────────────────────────

export function generateReferralLink(userAddress: string): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin;
  return `${base}/?${REFERRAL_PARAM}=${userAddress}`;
}

// ─── حساب توزيع الرسوم ───────────────────────────────────────────────────

export function splitFee(totalFeeBps: bigint, hasReferrer: boolean): {
  referrerBps: bigint;   // للمُحيل
  protocolBps: bigint;   // لـ CoinBin
} {
  if (!hasReferrer) {
    return { referrerBps: BigInt(0), protocolBps: totalFeeBps };
  }
  // 20% للمُحيل، 80% للبروتوكول
  const referrerBps = (totalFeeBps * BigInt(REFERRAL_FEE_SHARE)) / BigInt(100);
  const protocolBps = totalFeeBps - referrerBps;
  return { referrerBps, protocolBps };
}

// ─── تتبع إحصائيات الإحالة (local) ──────────────────────────────────────

export interface ReferralStats {
  totalReferred: number;
  totalEarnedUSD: number;
  lastActivity: string;
}

export function getReferralStats(myAddress: string): ReferralStats {
  if (typeof window === "undefined") return { totalReferred: 0, totalEarnedUSD: 0, lastActivity: "" };
  const key = `coinbin_referral_stats_${myAddress.toLowerCase()}`;
  const raw = localStorage.getItem(key);
  if (!raw) return { totalReferred: 0, totalEarnedUSD: 0, lastActivity: "" };
  try { return JSON.parse(raw); } catch { return { totalReferred: 0, totalEarnedUSD: 0, lastActivity: "" }; }
}

export function recordReferralActivity(myAddress: string, earnedUSD: number): void {
  if (typeof window === "undefined") return;
  const key = `coinbin_referral_stats_${myAddress.toLowerCase()}`;
  const stats = getReferralStats(myAddress);
  const updated: ReferralStats = {
    totalReferred: stats.totalReferred + 1,
    totalEarnedUSD: stats.totalEarnedUSD + earnedUSD,
    lastActivity: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(updated));
}
