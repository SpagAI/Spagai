import { SpagLoader } from "./spag-loader";

/**
 * The loading screen for every page: the Spag logo "sound wave" animation in the centre.
 * It uses the text colour, so it is black in Day (white) mode and white in Night (black) mode.
 */
export function PageLoader({ label = "Loading…", fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div className={fullScreen ? "flex min-h-dvh flex-col items-center justify-center gap-4" : "flex min-h-[60vh] flex-col items-center justify-center gap-4"}>
      <SpagLoader className="h-16 text-foreground" label={label} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
