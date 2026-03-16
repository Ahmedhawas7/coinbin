"use client";
// src/app/dashboard/page.tsx
// لوحة تحكم مالك CoinBin — يرى إيراداته الحية
// الوصول: /dashboard (يمكن إضافة حماية بكلمة سر لاحقاً)

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  ConnectWallet,
  Wallet,
} from "@coinbase/onchainkit/wallet";
import { Avatar, Name } from "@coinbase/onchainkit/identity";
import { usePublicClient } from "wagmi";
import { formatUSDC } from "@/lib/sweep";
import { FEE_RECIPIENT, TOKENS, ERC20_ABI } from "@/config/contracts";
import Link from "next/link";

// بيانات محاكاة للعرض — في الإنتاج تُجلب من indexer أو subgraph
const MOCK_DAILY = [
  { date: "اليوم",    txCount: 47,  feesUSDC: 142.30, users: 38 },
  { date: "أمس",     txCount: 61,  feesUSDC: 198.75, users: 52 },
  { date: "الاثنين", txCount: 33,  feesUSDC: 87.20,  users: 28 },
  { date: "الأحد",   txCount: 55,  feesUSDC: 163.40, users: 44 },
  { date: "السبت",   txCount: 72,  feesUSDC: 241.90, users: 61 },
  { date: "الجمعة",  txCount: 49,  feesUSDC: 155.60, users: 40 },
  { date: "الخميس",  txCount: 38,  feesUSDC: 112.80, users: 31 },
];

function StatCard({
  label, value, sub, accent
}: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#111318] border border-[#1E2028] rounded-xl p-4">
      <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${accent ?? "text-white"}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1E2028] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#0052FF] rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [feeBalance, setFeeBalance] = useState<bigint>(0n);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // جلب رصيد USDC في محفظة رسوم البروتوكول
  useEffect(() => {
    if (!publicClient) return;
    setLoadingBalance(true);
    publicClient.readContract({
      address: TOKENS.USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [FEE_RECIPIENT as `0x${string}`],
    })
    .then((bal) => setFeeBalance(bal as bigint))
    .catch(() => {})
    .finally(() => setLoadingBalance(false));
  }, [publicClient]);

  const totalWeekFees = MOCK_DAILY.reduce((s, d) => s + d.feesUSDC, 0);
  const totalWeekTx   = MOCK_DAILY.reduce((s, d) => s + d.txCount, 0);
  const totalWeekUsers = MOCK_DAILY.reduce((s, d) => s + d.users, 0);
  const maxFee = Math.max(...MOCK_DAILY.map((d) => d.feesUSDC));

  return (
    <div className="min-h-screen bg-[#0A0B0D]">
      {/* Header */}
      <header className="border-b border-[#1E2028] bg-[#0A0B0D]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-600 hover:text-gray-300 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-sm font-semibold text-white">🗑️ CoinBin</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/20">
              لوحة المالك
            </span>
          </div>
          <Wallet>
            <ConnectWallet className="!bg-transparent !border !border-[#1E2028] !text-white !rounded-xl !text-sm !px-3 !py-1.5 hover:!border-[#2E3038] transition-colors">
              <Avatar className="h-5 w-5" />
              <Name />
            </ConnectWallet>
          </Wallet>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* تحذير: هذه بيانات تجريبية */}
        <div className="mb-6 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3">
          <span>⚠️</span>
          <span>
            البيانات أدناه تجريبية. في الإنتاج، اربط بـ{" "}
            <span className="font-mono">Subgraph</span> أو{" "}
            <span className="font-mono">Dune Analytics</span> لتتبع المعاملات الحقيقية.
          </span>
        </div>

        {/* إحصائيات عليا */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="رصيد USDC (محفظة الرسوم)"
            value={loadingBalance ? "..." : formatUSDC(feeBalance)}
            sub="جاهز للسحب"
            accent="text-emerald-400"
          />
          <StatCard
            label="إيرادات هذا الأسبوع"
            value={`$${totalWeekFees.toFixed(2)}`}
            sub={`${MOCK_DAILY[0].feesUSDC.toFixed(2)}$ اليوم`}
            accent="text-[#0052FF]"
          />
          <StatCard
            label="معاملات هذا الأسبوع"
            value={totalWeekTx.toString()}
            sub={`${MOCK_DAILY[0].txCount} اليوم`}
          />
          <StatCard
            label="مستخدمون هذا الأسبوع"
            value={totalWeekUsers.toString()}
            sub={`${MOCK_DAILY[0].users} نشط اليوم`}
          />
        </div>

        {/* إسقاطات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <StatCard
            label="إسقاط شهري"
            value={`$${(totalWeekFees * 4.3).toFixed(0)}`}
            sub="بناءً على متوسط الأسبوع"
            accent="text-amber-400"
          />
          <StatCard
            label="إسقاط سنوي"
            value={`$${(totalWeekFees * 52).toFixed(0)}`}
            sub="بنفس معدل النمو الحالي"
            accent="text-amber-400"
          />
          <StatCard
            label="متوسط رسوم / معاملة"
            value={`$${(totalWeekFees / totalWeekTx).toFixed(3)}`}
            sub="USDC لكل sweep"
          />
        </div>

        {/* جدول الأداء اليومي */}
        <div className="rounded-2xl border border-[#1E2028] overflow-hidden mb-8">
          <div className="px-5 py-3.5 border-b border-[#1E2028]">
            <span className="text-sm font-medium text-white">أداء آخر 7 أيام</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2028]">
                {["اليوم", "المعاملات", "المستخدمون", "الرسوم (USDC)", "التوزيع"].map((h) => (
                  <th key={h} className="text-[10px] text-gray-600 font-normal uppercase tracking-widest py-2.5 px-4 text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_DAILY.map((day, i) => (
                <tr key={i} className="border-b border-[#1E2028] last:border-0 hover:bg-[#111318]">
                  <td className="py-3 px-4 text-sm text-gray-300">{day.date}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{day.txCount}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{day.users}</td>
                  <td className="py-3 px-4 text-sm font-medium text-emerald-400">
                    ${day.feesUSDC.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 w-32">
                    <MiniBar value={day.feesUSDC} max={maxFee} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* نموذج الإيرادات */}
        <div className="rounded-2xl border border-[#1E2028] bg-[#0E1015] overflow-hidden mb-8">
          <div className="px-5 py-3.5 border-b border-[#1E2028]">
            <span className="text-sm font-medium text-white">🧮 حاسبة الإيرادات</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {[
                { label: "100 مستخدم/يوم × $50 متوسط",  daily: 100*50, fee: 0.003 },
                { label: "500 مستخدم/يوم × $100 متوسط", daily: 500*100, fee: 0.003 },
                { label: "2000 مستخدم/يوم × $200 متوسط",daily: 2000*200, fee: 0.003 },
              ].map((scenario, i) => {
                const dailyFee = scenario.daily * scenario.fee;
                return (
                  <div key={i} className="bg-[#0A0B0D] rounded-xl p-4 border border-[#1E2028]">
                    <div className="text-[10px] text-gray-600 mb-3">{scenario.label}</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">يومي</span>
                        <span className="text-white">${dailyFee.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">شهري</span>
                        <span className="text-[#0052FF]">${(dailyFee * 30).toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">سنوي</span>
                        <span className="text-emerald-400 font-medium">${(dailyFee * 365).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-700 mt-4 text-center">
              بناءً على رسوم 0.3% · هذه توقعات تقريبية فقط
            </p>
          </div>
        </div>

        {/* سحب الرسوم */}
        <div className="rounded-2xl border border-emerald-900/30 bg-emerald-950/10 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-emerald-900/30">
            <span className="text-sm font-medium text-white">💸 سحب الإيرادات</span>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">محفظة الرسوم</div>
                <div className="font-mono text-sm text-gray-300">
                  {FEE_RECIPIENT.slice(0, 10)}...{FEE_RECIPIENT.slice(-6)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  تذهب الرسوم تلقائياً لهذا العنوان — سحبها مباشرة من أي DEX
                </div>
              </div>
              <a
                href={`https://basescan.org/address/${FEE_RECIPIENT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl border border-emerald-700/40 bg-emerald-700/10 text-emerald-400 text-sm hover:bg-emerald-700/20 transition-all"
              >
                عرض على BaseScan ↗
              </a>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
