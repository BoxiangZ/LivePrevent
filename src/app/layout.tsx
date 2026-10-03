import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoProvider } from "@/components/DemoProvider";
import { CriticalBanner } from "@/components/CriticalBanner";
import { DemoPanel } from "@/components/DemoPanel";

export const metadata: Metadata = {
  title: "LivePrevent",
  description:
    "AI-assisted home monitoring and alerting for aging in place. 辅助监测与提示工具，不提供医疗诊断，不替代紧急呼叫服务。",
};

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/alerts", label: "Alerts" },
  { href: "/elders/sub_mum", label: "Mum" },
  { href: "/board", label: "Board (Phase 2)" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <DemoProvider>
          <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <Link href="/overview" className="text-lg font-bold tracking-tight">
                Live<span className="text-indigo-600">Prevent</span>
              </Link>
              <nav className="flex gap-1 text-sm">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <span className="ml-auto hidden text-[11px] text-gray-400 md:block">
                辅助监测与提示工具 · 不替代紧急呼叫服务
              </span>
            </div>
          </header>
          <CriticalBanner />
          <main className="pb-20">{children}</main>
          <DemoPanel />
        </DemoProvider>
      </body>
    </html>
  );
}
