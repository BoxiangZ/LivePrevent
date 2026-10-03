"use client";

/**
 * Demo 状态 Provider — 500ms 轮询 GET /api/demo/state。
 * 服务端引擎为懒求值，轮询频率不影响正确性；
 * 倒计时以快照 nowMs 为基准，避免时钟偏差。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DemoStateSnapshot } from "@/server/snapshot";

interface DemoContextValue {
  snapshot: DemoStateSnapshot | null;
  /** 以服务端 nowMs 为基准的剩余毫秒数（负数表示已到期） */
  msUntil: (iso: string | null | undefined) => number | null;
  refresh: () => Promise<void>;
  injectFall: () => Promise<void>;
  injectInactivity: () => Promise<void>;
  resetDemo: () => Promise<void>;
  ackAlert: (alertId: string, contactId?: string, token?: string) => Promise<void>;
  resolveAlert: (alertId: string, reason: string, note?: string) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  requestKimiSummary: (eventId: string) => Promise<void>;
  busy: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const POLL_MS = 500;

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<DemoStateSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  // 服务端与客户端的时钟差（snapshot.nowMs - 本地收到时刻）
  const skewRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/demo/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as DemoStateSnapshot;
      skewRef.current = data.nowMs - Date.now();
      setSnapshot(data);
    } catch {
      // 网络抖动时保留旧快照，下一秒重试
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const serverNow = useCallback(() => Date.now() + skewRef.current, []);

  const msUntil = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return null;
      return Date.parse(iso) - serverNow();
    },
    [serverNow]
  );

  const withBusy = useCallback(
    async (fn: () => Promise<Response>) => {
      setBusy(true);
      try {
        await fn();
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh]
  );

  const injectFall = useCallback(
    () =>
      withBusy(() =>
        fetch("/api/demo/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: "fall" }),
        })
      ),
    [withBusy]
  );

  const injectInactivity = useCallback(
    () =>
      withBusy(() =>
        fetch("/api/demo/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: "inactivity" }),
        })
      ),
    [withBusy]
  );

  const resetDemo = useCallback(
    () => withBusy(() => fetch("/api/demo/reset", { method: "POST" })),
    [withBusy]
  );

  const ackAlert = useCallback(
    (alertId: string, contactId?: string, token?: string) =>
      withBusy(() =>
        fetch(`/api/alerts/${alertId}/ack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId, token }),
        })
      ),
    [withBusy]
  );

  const resolveAlert = useCallback(
    (alertId: string, reason: string, note?: string) =>
      withBusy(() =>
        fetch(`/api/alerts/${alertId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, note }),
        })
      ),
    [withBusy]
  );

  const setPaused = useCallback(
    (paused: boolean) =>
      withBusy(() =>
        fetch("/api/demo/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused }),
        })
      ),
    [withBusy]
  );

  const requestKimiSummary = useCallback(
    (eventId: string) =>
      withBusy(() =>
        fetch("/api/kimi/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        })
      ),
    [withBusy]
  );

  return (
    <DemoContext.Provider
      value={{
        snapshot,
        msUntil,
        refresh,
        injectFall,
        injectInactivity,
        resetDemo,
        ackAlert,
        resolveAlert,
        setPaused,
        requestKimiSummary,
        busy,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
