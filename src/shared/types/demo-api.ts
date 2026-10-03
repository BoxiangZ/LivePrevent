import type { EventSignal, EventType } from "./event";
import type { JevProbabilities } from "./jev";
import type { RiskLevel } from "./risk";

/** Synthetic observation submitted by a demo operator. No raw video or health record. */
export interface ObservationInput {
  personId: string;
  idempotencyKey: string;
  eventType: EventType;
  occurredAt: string;
  signals: EventSignal[];
  probabilities: JevProbabilities;
  insufficientData: boolean;
  recoveryObserved: boolean;
  note: string;
}

export interface ObservationOutput {
  runId: string;
  personId: string;
  eventId: string;
  alertId: string | null;
  level: RiskLevel;
  probabilities: JevProbabilities;
  ruleApplied: string;
  cappedReason: string | null;
  recoveryWindowEndsAt: string | null;
  synthetic: true;
}
