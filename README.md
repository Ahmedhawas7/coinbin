# 🗑️ CoinBin — سلة الكوين

> نظّف محفظتك على Base · بيع الرموز → USDC + حرق الغبار في ضغطة واحدة

---

## ✨ الميزات الكاملة

| الميزة | التفاصيل |
|--------|---------|
| 💰 بيع دفعة واحدة | جميع رموزك → USDC في معاملة واحدة عبر Uniswap V3 |
| 🔥 حرق الرموز الميتة | توكنات بلا سيولة → حرق فوري لعنوان 0xdead |
| 🤖 تصنيف ذكي | تلقائياً يفرق بين ما يُباع وما يُحرق |
| 💸 رسوم البروتوكول | 0.3% من كل صفقة تذهب لمحفظة CoinBin |
| 🔗 نظام الإحالة | 20% عمولة لكل مستخدم يحيل آخرين |
| 📊 لوحة المالك | تتبع الإيرادات على /dashboard |
| 🌐 Base متخصص | سرعة عالية + رسوم غاز منخفضة |
| 🔵 Coinbase Smart Wallet | تجربة مثلى للمستخدمين الجدد |

---

## 🚀 خطوات النشر

### 1. تثبيت المكتبات

```bash
npm install
```

### 2. إعداد المتغيرات البيئية

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_ONCHAINKIT_API_KEY=     # portal.cdp.coinbase.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # cloud.walletconnect.com
NEXT_PUBLIC_APP_URL=https://coinbin.app
```

### 3. تغيير محفظة الرسوم (مهم!)

في src/config/contracts.ts:
```typescript
export const FEE_RECIPIENT = "0xYourWalletAddressHere";
```

### 4. تشغيل محلي

```bash
npm run dev
```

### 5. نشر Vercel

```bash
npx vercel --prod
```

---

## 💰 نموذج الإيرادات

```
100 مستخدم/يوم × $500 متوسط × 0.3% = $150/يوم = $4,500/شهر
500 مستخدم/يوم × $500 متوسط × 0.3% = $750/يوم = $22,500/شهر
```

نظام الإحالة: 20% من الرسوم للمُحيل، 80% للبروتوكول

---

## 🏗 هيكل المشروع

```
src/
├── app/
│   ├── page.tsx              # الصفحة الرئيسية
│   ├── dashboard/page.tsx    # لوحة تحكم المالك
│   ├── layout.tsx
│   └── providers.tsx
├── components/
│   ├── TokenRow.tsx
│   ├── SweepPanel.tsx
│   ├── StatsBar.tsx
│   └── ReferralCard.tsx      # نظام الإحالة
├── hooks/
│   ├── useTokenBalances.ts
│   └── useSweep.ts
├── lib/
│   ├── sweep.ts              # بيع + حرق + رسوم
│   ├── tokens.ts
│   └── referral.ts           # منطق الإحالة
└── config/
    ├── wagmi.ts
    └── contracts.ts          # FEE_RECIPIENT + إعدادات
```

---

## 📄 ترخيص MIT
