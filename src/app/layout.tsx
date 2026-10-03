import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoProvider } from "@/client/provider/DemoProvider";
import { CriticalBanner } from "@/client/components/CriticalBanner";
import { NavLinks } from "@/client/components/NavLinks";
import { PersonSelector } from "@/client/components/PersonSelector";
import { ConnectionStatus } from "@/client/components/ConnectionStatus";

export const metadata: Metadata = {
  title: "LivePrevent — Calm home monitoring for aging in place",
  description:
    "LivePrevent learns an older adult's personal baseline and flags meaningful deviations early. An assistive monitoring tool — not a medical device, not an emergency service.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-soft font-sans text-ink antialiased">
        <DemoProvider>
          <header className="sticky top-0 z-30 border-b border-surface-line bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
              <Link href="/overview" className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                  LP
                </span>
                <span className="text-[17px] font-semibold tracking-tight text-ink">
                  LivePrevent
                </span>
              </Link>
              <NavLinks />
              <div className="ml-auto flex items-center gap-3">
                <PersonSelector />
              </div>
            </div>
          </header>
          <CriticalBanner />
          <ConnectionStatus />
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
          <footer className="border-t border-surface-line bg-white py-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-ink-mute sm:px-6">
              <span>
                LivePrevent is an assistive monitoring tool — it does not provide medical diagnosis
                and does not replace emergency services.
              </span>
              <span>Your information, shared only for the selected review.</span>
            </div>
          </footer>

        </DemoProvider>
      </body>
    </html>
  );
}
