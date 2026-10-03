"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/client/provider/DemoProvider";
import { cn } from "@/client/cn";

export function NavLinks() {
  const pathname = usePathname();
  const { snapshot } = useDemo();
  const openCount =
    snapshot?.alerts.filter((a) => a.status === "open" || a.status === "acknowledged").length ?? 0;
  const subjectId = snapshot?.subject.id;

  const NAV = [
    { href: "/overview", label: "Overview" },
    { href: "/alerts", label: "Alerts" },
    { href: "/demo-studio", label: "Demo I/O" },
    { href: subjectId ? `/people/${subjectId}` : "/overview", label: "Person details" },
    { href: "/care-network", label: "Care Network" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="flex items-center gap-1 text-sm">
      {NAV.map((n) => {
        const base = n.href.split("/").slice(0, 2).join("/");
        const active =
          pathname === n.href ||
          pathname.startsWith(n.href + "/") ||
          (base !== n.href && (pathname === base || pathname.startsWith(base + "/")));
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative rounded-lg px-3 py-1.5 font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-surface-soft hover:text-ink"
            )}
          >
            {n.label}
            {n.href === "/alerts" && openCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
                {openCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
