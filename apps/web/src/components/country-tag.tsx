/** A small country code tag, e.g. "NG". (Flag emoji do not show on Windows.) */
export function CountryTag({ code }: { code: string }) {
  return (
    <span className="mr-1.5 inline-grid h-4 min-w-6 place-items-center rounded-[4px] bg-muted px-1 align-[1px] text-[10px] font-semibold tracking-wide text-muted-foreground">
      {code || "—"}
    </span>
  );
}
