"use client";

import { useDemo } from "@/client/provider/DemoProvider";

export function ConnectionStatus() {
  const { error, snapshot } = useDemo();
  const message = error ?? (snapshot?.dataStatus.stale ? "Device data is stale or unavailable. Check the devices before relying on this status." : null);
  if (!message) return null;
  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900">
      {message}
    </div>
  );
}
