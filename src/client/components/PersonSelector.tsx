"use client";

import { useDemo } from "@/client/provider/DemoProvider";
import { usePathname, useRouter } from "next/navigation";

export function PersonSelector() {
  const { snapshot, selectedPersonId, selectPerson } = useDemo();
  const pathname = usePathname();
  const router = useRouter();
  const people = snapshot?.people ?? [];

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
      <span>Person</span>
      <select
        aria-label="Select monitored person"
        value={selectedPersonId}
        onChange={(event) => {
          const nextId = event.target.value;
          selectPerson(nextId);
          if (pathname.startsWith("/people/")) router.push(`/people/${nextId}`);
          if (pathname.startsWith("/events/") || pathname.startsWith("/ack/")) router.push("/overview");
        }}
        disabled={people.length === 0}
        className="max-w-52 rounded-lg border border-surface-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brand-500 focus:outline-none"
      >
        {people.length === 0 && <option value={selectedPersonId}>Loading…</option>}
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.label}{person.openAlertCount ? ` · ${person.openAlertCount} alert${person.openAlertCount === 1 ? "" : "s"}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
