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
import { api } from "@/client/api";
import { snapshotSchema } from "@/shared/contracts/snapshot";
import { peopleSchema } from "@/shared/contracts/assessment";
import { usePathname, useRouter } from "next/navigation";
import type { DemoStateSnapshot } from "@/server/snapshot";

interface DemoContextValue {
  snapshot: DemoStateSnapshot | null;
  people: DemoStateSnapshot["people"];
  selectedPersonId: string;
  selectPerson: (personId: string) => void;
  error: string | null;
  /** 以服务端 nowMs 为基准的剩余毫秒数（负数表示已到期） */
  msUntil: (iso: string | null | undefined) => number | null;
  refresh: () => Promise<void>;
  injectFall: () => Promise<void>;
  injectInactivity: () => Promise<void>;
  resetDemo: () => Promise<void>;
  ackAlert: (
    alertId: string,
    contactId?: string,
    token?: string,
  ) => Promise<void>;
  resolveAlert: (
    alertId: string,
    reason: string,
    note?: string,
  ) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  requestKimiSummary: (eventId: string) => Promise<void>;
  busy: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const POLL_MS = 5000;

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<DemoStateSnapshot | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [people, setPeople] = useState<DemoStateSnapshot["people"]>([]);
  const personRef = useRef("sub_margaret");
  const [busy, setBusy] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState("sub_margaret");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 服务端与客户端的时钟差（snapshot.nowMs - 本地收到时刻）
  const skewRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v3/people/${encodeURIComponent(selectedPersonId)}/snapshot`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (
        [403, 404].includes(res.status) &&
        selectedPersonId !== "sub_margaret"
      ) {
        personRef.current = "sub_margaret";
        window.localStorage.removeItem("lp_selected_person");
        setSelectedPersonId("sub_margaret");
        return;
      }
      if (!res.ok)
        throw new Error(`Unable to load current status (${res.status})`);
      const data = snapshotSchema.parse((await res.json()).data);
      if (personRef.current !== selectedPersonId) return;
      setPeople(data.people);
      skewRef.current = data.nowMs - Date.now();
      setSnapshot(data);
      setError(null);
    } catch {
      if (personRef.current === selectedPersonId)
        setError(
          "Unable to verify current status. Check the connection and try again.",
        );
    }
  }, [selectedPersonId, router]);

  useEffect(() => {
    const saved = window.localStorage.getItem("lp_selected_person");
    if (saved) {
      personRef.current = saved;
      setSelectedPersonId(saved);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || pathname === "/login") return;
    api("people", peopleSchema)
      .then(setPeople)
      .catch(() => undefined);
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [ready, refresh, pathname]);

  const selectPerson = useCallback(
    (personId: string) => {
      if (personId === selectedPersonId) return;
      personRef.current = personId;
      setSnapshot(null);
      setError(null);
      setSelectedPersonId(personId);
      window.localStorage.setItem("lp_selected_person", personId);
    },
    [selectedPersonId],
  );

  const serverNow = useCallback(() => Date.now() + skewRef.current, []);

  const msUntil = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return null;
      return Date.parse(iso) - serverNow();
    },
    [serverNow],
  );

  const withBusy = useCallback(
    async (fn: () => Promise<Response>) => {
      setBusy(true);
      try {
        const response = await fn();
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body.message ?? body.error ?? `Action failed (${response.status})`,
          );
        } else {
          setError(null);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Action failed. Check the connection and try again.",
        );
        throw e;
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh],
  );

  const injectFall = useCallback(
    () =>
      withBusy(() =>
        fetch("/api/demo/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: "fall",
            personId: selectedPersonId,
          }),
        }),
      ),
    [withBusy, selectedPersonId],
  );

  const injectInactivity = useCallback(
    () =>
      withBusy(() =>
        fetch("/api/demo/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: "inactivity",
            personId: selectedPersonId,
          }),
        }),
      ),
    [withBusy, selectedPersonId],
  );

  const resetDemo = useCallback(
    () =>
      withBusy(() =>
        fetch("/api/demo/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId: selectedPersonId }),
        }),
      ),
    [withBusy, selectedPersonId],
  );

  const ackAlert = useCallback(
    (alertId: string, contactId?: string, token?: string) =>
      withBusy(() =>
        fetch(`/api/v3/alerts/${alertId}/ack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId,
            token,
            personId: selectedPersonId,
          }),
        }),
      ),
    [withBusy, selectedPersonId],
  );

  const resolveAlert = useCallback(
    (alertId: string, reason: string, note?: string) =>
      withBusy(() =>
        fetch(`/api/v3/alerts/${alertId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, note, personId: selectedPersonId }),
        }),
      ),
    [withBusy, selectedPersonId],
  );

  const setPaused = useCallback(
    (paused: boolean) =>
      withBusy(() =>
        fetch("/api/demo/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused, personId: selectedPersonId }),
        }),
      ),
    [withBusy, selectedPersonId],
  );

  const requestKimiSummary = useCallback(
    (eventId: string) =>
      withBusy(() =>
        fetch("/api/kimi/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        }),
      ),
    [withBusy],
  );

  return (
    <DemoContext.Provider
      value={{
        snapshot,
        people,
        selectedPersonId,
        selectPerson,
        error,
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
