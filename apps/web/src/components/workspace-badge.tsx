import { cn } from "@/lib/utils";

/**
 * The workspace icon: a small briefcase in the brand purple with the owner's first initial on it
 * ("Y" for Yakub's Workspace). Larger and more graphical than the menu icons, on purpose.
 */
export function WorkspaceBadge({ letter, className }: { letter: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      {/* handle */}
      <path d="M11.5 9.5V7.6A2.6 2.6 0 0 1 14.1 5h3.8a2.6 2.6 0 0 1 2.6 2.6v1.9" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" />
      {/* body */}
      <rect x="2.5" y="9" width="27" height="20" rx="5" fill="var(--primary)" />
      {/* the clasp line, softly */}
      <path d="M3 16.5h26" stroke="var(--primary-foreground)" strokeOpacity="0.18" strokeWidth="1.2" />
      <text x="16" y="24.2" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--font-inter), system-ui, sans-serif" fill="var(--primary-foreground)">
        {letter}
      </text>
    </svg>
  );
}

/** First letter of the owner's first name (falls back to the email). */
export function ownerInitial(owner: { name: string | null; email: string } | null | undefined): string {
  const first = owner?.name?.trim().split(/\s+/)[0] || owner?.email.split("@")[0] || "?";
  return first[0]!.toUpperCase();
}
