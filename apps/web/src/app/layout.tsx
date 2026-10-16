import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { ScrollActivity } from "@/components/scroll-activity";
import { I18nProvider } from "@/i18n/client";
import { getLocale } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { savedTheme, THEME_COOKIE, themeClass } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Spag AI Studio", template: "%s · Spag AI Studio" },
  description: "Build and run AI voice agents for Nigerian businesses.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Inter, served from our own site by Next.js (the browser makes no request to Google). */
const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // The saved appearance is applied on the server, so the page never flashes the wrong colours.
  const theme = savedTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang={locale === "en" ? "en-NG" : locale} className={cn(inter.variable, themeClass(theme))} data-theme={theme}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <ScrollActivity />
      </body>
    </html>
  );
}
