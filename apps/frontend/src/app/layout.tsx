import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import ClientProviders from "@/components/providers/ClientProviders";
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale } from "@/lib/i18n/config";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "MIPAAS | Clinical-grade imaging AI, from scan to signed report",
  description:
    "MiPAAS AI is on a mission to provide accessible, affordable, & timely assistance to healthcare professionals worldwide.",
  keywords: "AI healthcare, radiology AI, chest X-ray AI, stroke AI, lung cancer AI, tuberculosis AI",
  openGraph: {
    title: "MIPAAS | Clinical-grade imaging AI, from scan to signed report",
    description:
      "MiPAAS AI is on a mission to provide accessible, affordable, & timely assistance to healthcare professionals.",
    type: "website",
    url: "https://www.mipaas.ai",
    siteName: "MiPAAS AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "MIPAAS | Clinical-grade imaging AI, from scan to signed report",
    description:
      "MiPAAS AI is on a mission to provide accessible, affordable, & timely assistance to healthcare professionals.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : DEFAULT_LOCALE;
  return (
    <html lang={locale} className={`dark h-full ${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Josefin+Sans:wght@700&family=Sora:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&family=Noto+Sans+Bengali:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;500;600&family=Noto+Sans+Telugu:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased">
        <ClientProviders locale={locale}>{children}</ClientProviders>
      </body>
    </html>
  );
}
