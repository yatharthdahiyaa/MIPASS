import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "@/components/providers/ClientProviders";

export const metadata: Metadata = {
  title: "MiPAAS AI | AI Assistance for Accelerated Healthcare",
  description:
    "MiPAAS AI is on a mission to provide accessible, affordable, & timely assistance to healthcare professionals worldwide.",
  keywords: "AI healthcare, radiology AI, chest X-ray AI, stroke AI, lung cancer AI, tuberculosis AI",
  openGraph: {
    title: "MiPAAS AI | AI Assistance for Accelerated Healthcare",
    description:
      "MiPAAS AI is on a mission to provide accessible, affordable, & timely assistance to healthcare professionals.",
    type: "website",
    url: "https://www.mipaas.ai",
    siteName: "MiPAAS AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "MiPAAS AI | AI Assistance for Accelerated Healthcare",
    description:
      "MiPAAS AI is on a mission to provide accessible, affordable, & timely assistance to healthcare professionals.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Josefin+Sans:wght@700&family=Sora:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
