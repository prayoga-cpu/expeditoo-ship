import { initialsOf } from "@/lib/initials";

interface RequesterCellProps {
  name: string | null | undefined;
  email?: string | null;
}

/**
 * « Demandeur » on the staff tables: the requester's first and last name with
 * their initials beside it as a reminder (client_feedback_2026_10_29_spec.md
 * §A4). Staff screens only — the drivers' board never says who posted a job.
 */
export function RequesterCell({ name, email }: RequesterCellProps) {
  const initials = initialsOf(name, email);
  if (!name && !email) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="flex items-center gap-2">
      {initials && (
        <span
          aria-hidden
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold text-muted-foreground"
        >
          {initials}
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{name || email}</span>
        {name && email && (
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        )}
      </div>
    </div>
  );
}
