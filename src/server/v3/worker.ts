import { heartbeat } from "@/server/monitoring";
import {
  initializeSampleHistory,
  advanceLongitudinal,
} from "@/server/longitudinal";
import { deliverNextEmail } from "@/server/notifications/email";
import { all, put } from "./repository";
import { runAssessment, type StoredAssessment } from "./assessments";
import { expireMedia } from "./media";
import { getStore, listPeople, saveStore } from "@/server/store";
import { advance } from "@/server/engine";
const state = globalThis as typeof globalThis & {
  lpWorkerVersion?: number;
  lpWorker?: ReturnType<typeof setInterval>;
  lpWorking?: boolean;
  lpAnalyzing?: boolean;
  lpSending?: boolean;
};
export function startWorker() {
  if (state.lpWorker && state.lpWorkerVersion === 2) return;
  if (state.lpWorker) clearInterval(state.lpWorker);
  state.lpWorkerVersion = 2;
  state.lpWorker = setInterval(async () => {
    if (state.lpWorking) return;
    state.lpWorking = true;
    try {
      expireMedia();
      for (const p of listPeople()) {
        const s = getStore(p.id);
        if (s) {
          const seeded = initializeSampleHistory(s);
          const received = heartbeat(s);
          const trend = advanceLongitudinal(s);
          const changed = advance(s, Date.now()).length;
          if (seeded || received || trend || changed) saveStore(s);
        }
      }
      if (!state.lpSending) {
        state.lpSending = true;
        void deliverNextEmail()
          .catch(() => console.error("Email worker failed"))
          .finally(() => {
            state.lpSending = false;
          });
      }
      const records = all<StoredAssessment>("assessment");
      for (const a of records)
        if (a.status === "analyzing" && (a.leaseUntil ?? 0) < Date.now()) {
          a.status = "failed";
          a.error = "Analysis was interrupted. Retry to continue.";
          a.retryable = true;
          put("assessment", a.assessmentId, a);
        }
      const next = records
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .find((a) => a.status === "queued");
      if (next && !state.lpAnalyzing) {
        state.lpAnalyzing = true;
        void runAssessment(next.assessmentId).finally(() => {
          state.lpAnalyzing = false;
        });
      }
    } catch (e) {
      console.error(
        "Background task failed",
        e instanceof Error ? e.message : "unknown",
      );
    } finally {
      state.lpWorking = false;
    }
  }, 1000);
  state.lpWorker.unref();
}
