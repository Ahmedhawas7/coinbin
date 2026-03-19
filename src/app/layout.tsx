import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"], 
  variable: "--font-jakarta" 
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space"
});

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
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050607",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${jakarta.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans bg-bg-primary text-white antialiased selection:bg-accent/30 selection:text-white">
        <Providers>
          <div className="mesh-gradient" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
