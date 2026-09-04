"use client";

import { ROLE_LABEL, type HandoverRole } from "@/app/lib/types";

const ROLES: HandoverRole[] = ["predecessor", "successor"];

export function RoleToggle({
  role,
  onChange,
  disabled,
}: {
  role: HandoverRole;
  onChange: (role: HandoverRole) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
      {ROLES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          disabled={disabled || r === role}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            r === role
              ? r === "predecessor"
                ? "bg-amber-100 text-amber-900 shadow-sm dark:bg-amber-900 dark:text-amber-100"
                : "bg-blue-100 text-blue-900 shadow-sm dark:bg-blue-900 dark:text-blue-100"
              : "text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}
