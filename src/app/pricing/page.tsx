"use client";

import Link from "next/link";
import { useUI } from "@/context/UIContext";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Free",
    nameAr: "مجاناً",
    price: "$0",
    period: "forever",
    periodAr: "للأبد",
    highlight: false,
    icon: "🗑️",
    features: [
      { en: "Burn unlimited dead tokens", ar: "حرق لا نهائي للتوكنات الميتة" },
      { en: "Free — no protocol fee on burns", ar: "مجاني — بلا رسوم على الحرق" },
      { en: "Sell tokens (0.3% protocol fee)", ar: "بيع التوكنات (0.3% رسوم)" },
      { en: "0x + Aerodrome + Uniswap routing", ar: "0x + Aerodrome + Uniswap" },
      { en: "Multi-token sweep in one click", ar: "تصفية العملات بضغطة واحدة" },
    ],
    cta: "Use Free",
    ctaAr: "ابدأ مجاناً",
    ctaHref: "/",
  },
  {
    name: "Pro",
    nameAr: "احترافي",
    price: "$1",
    period: "/ month",
    periodAr: "/ شهر",
    highlight: true,
    icon: "⚡",
    features: [
      { en: "Everything in Free", ar: "كل مزايا الخطة المجانية" },
      { en: "Pro badge on your wallet", ar: "شارة Pro على محفظتك" },
      { en: "Priority support", ar: "دعم فني مميز" },
      { en: "Early access to new features", ar: "وصول مبكر للمزايا الجديدة" },
      { en: "Help keep CoinBin running free", ar: "ساعدنا في إبقاء المنصة مجانية" },
    ],
    cta: "Get Pro",
    ctaAr: "اشترك الآن",
    ctaHref: "mailto:support@coinbin.app?subject=CoinBin%20Pro%20Subscription",
  },
];

export default function PricingPage() {
  const { isArabic } = useUI();

  return (
    <div className="min-h-screen bg-bg-main text-text-primary">
      <div className="mesh-gradient" />

      {/* Header */}
      <header className="v-glass sticky top-0 z-40 border-b-0">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-xl shadow-accent/20">
              <span className="text-white font-black text-lg">C</span>
            </div>
            <span className="text-xl font-black tracking-tighter text-text-primary uppercase">CoinBin</span>
          </Link>
          <Link
            href="/"
            className="text-[11px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors"
          >
            {isArabic ? "← الرئيسية" : "← Back to App"}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="text-center mb-20 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-text-primary leading-[0.9]">
            {isArabic ? "بسيط، شفاف، " : "Simple, transparent, "}
            <span className="text-accent italic">{isArabic ? "مجاني" : "free"}</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto font-medium">
            {isArabic
              ? "حرق التوكنات مجاني دائماً. البيع برسوم 0.3% فقط. لا مفاجآت."
              : "Token burns are always free. Selling costs 0.3% only. No surprises."}
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.12 }}
              className={`relative rounded-[2rem] p-8 border flex flex-col gap-8 ${
                plan.highlight
                  ? "bg-accent/5 border-accent/40 shadow-2xl shadow-accent/10"
                  : "bg-bg-surface border-divider"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white text-[9px] font-black uppercase tracking-[0.25em] px-5 py-1.5 rounded-full shadow-xl shadow-accent/30">
                  {isArabic ? "الأكثر دعماً" : "Support Us"}
                </div>
              )}

              {/* Plan Header */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{plan.icon}</span>
                  <h2 className="text-2xl font-black text-text-primary">{isArabic ? plan.nameAr : plan.name}</h2>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black text-text-primary">{plan.price}</span>
                  <span className="text-text-muted font-bold mb-1">{isArabic ? plan.periodAr : plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                      plan.highlight ? "bg-accent/20 text-accent" : "bg-emerald-500/20 text-emerald-500"
                    }`}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[13px] font-semibold text-text-secondary">{isArabic ? f.ar : f.en}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.ctaHref}
                className={`text-center py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                  plan.highlight
                    ? "bg-accent text-white shadow-xl shadow-accent/25 hover:opacity-90"
                    : "bg-bg-elevated text-text-primary border border-divider hover:border-text-muted/50"
                }`}
              >
                {isArabic ? plan.ctaAr : plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-24 max-w-2xl mx-auto space-y-6 text-center">
          <h2 className="text-2xl font-black text-text-primary">
            {isArabic ? "أسئلة شائعة" : "Frequently Asked"}
          </h2>
          {[
            {
              q: { en: "Is burning tokens really free?", ar: "هل حرق التوكنات مجاني حقاً؟" },
              a: { en: "Yes. Burning (sending to 0xdead) has zero protocol fee. You only pay the Base network gas fee, which is typically less than $0.01.", ar: "نعم. الحرق (إرسال إلى 0xdead) بلا أي رسوم بروتوكول. تدفع فقط رسوم gas على شبكة Base، وعادةً أقل من 0.01$." },
            },
            {
              q: { en: "What is the 0.3% fee for?", ar: "ما هي الـ 0.3%؟" },
              a: { en: "It's applied only on token sales (not burns). It covers infrastructure costs and keeps CoinBin running for free.", ar: "تُطبَّق فقط على عمليات البيع وليس الحرق. تغطي تكاليف البنية التحتية وتُبقي المنصة مجانية للجميع." },
            },
            {
              q: { en: "What is the Pro plan?", ar: "ما هي خطة Pro؟" },
              a: { en: "Pro is a $1/month supporter tier. Same core features, plus a Pro badge and priority support. It directly helps us keep the project alive.", ar: "Pro هي خطة دعم بـ 1$/شهر. نفس المزايا الأساسية + شارة Pro ودعم مميز. تساعدنا مباشرةً في الاستمرار." },
            },
          ].map((item, i) => (
            <div key={i} className="v-card p-6 text-left space-y-2">
              <p className="font-black text-text-primary text-sm">{isArabic ? item.q.ar : item.q.en}</p>
              <p className="text-text-secondary text-[13px] font-medium leading-relaxed">{isArabic ? item.a.ar : item.a.en}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
