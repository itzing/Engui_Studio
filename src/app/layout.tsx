import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "yet-another-react-lightbox/styles.css";
import { I18nProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/components/ui/toast";
import { PWARegistration } from "@/components/pwa/PWARegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EnguiStudio - AI Content Creation",
  description: "Create amazing content with the power of AI.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EnguiStudio",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased custom-scrollbar`}
      >
        <I18nProvider>
          <ToastProvider>
            <PWARegistration />
            {children}
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
