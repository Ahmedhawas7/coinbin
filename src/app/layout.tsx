import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-coinbase" });

export const metadata: Metadata = {
  title: "CoinBin 🗑️ — سلة الكوين | نظّف محفظتك على Base",
  description:
    "بيع جميع رموزك مقابل USDC + حرق التوكنات الميتة في معاملة واحدة على Base عبر Uniswap V3",
  openGraph: {
    title: "CoinBin 🗑️ — سلة الكوين",
    description: "نظّف محفظتك: بيع الرموز → USDC وحرق الغبار في ضغطة واحدة على Base",
    siteName: "CoinBin",
  },
  other: {
    "base:app_id": "697b0897748a9bde7c61ab55",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${inter.variable} font-sans bg-base-dark text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
