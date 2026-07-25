import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AuthRecoveryRedirect } from "@/components/auth-recovery-redirect";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TicketFly",
    template: "%s · TicketFly",
  },
  description: "Bilheteria online premium para shows, festivais e experiencias VIP. Voe mais alto. Viva experiências.",
  applicationName: "TicketFly",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "TicketFly",
    description: "Bilheteria online premium para shows, festivais e experiencias VIP.",
    siteName: "TicketFly",
    images: [{ url: "/brand/og-square.png", width: 1200, height: 1200, alt: "TicketFly" }],
  },
  twitter: {
    card: "summary",
    title: "TicketFly",
    description: "Bilheteria online premium para shows, festivais e experiencias VIP.",
    images: ["/brand/og-square.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthRecoveryRedirect />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
