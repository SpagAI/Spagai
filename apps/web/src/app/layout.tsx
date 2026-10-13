import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/i18n/client";
import { getLocale } from "@/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Spag AI Studio", template: "%s · Spag AI Studio" },
  description: "Build and run AI voice agents for Nigerian businesses.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale === "en" ? "en-NG" : locale}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
