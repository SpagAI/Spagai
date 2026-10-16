import { cn } from "@/lib/utils";

/**
 * The Spag AI mark, as a true vector (public/spag-logo-mark.svg, traced from the logo artwork).
 * It is used as a mask, so it stays razor sharp at any size, has no background and takes the
 * current text colour. Width follows the artwork's proportions (755 x 992).
 */
export function SpagLogo({ className, title = "Spag AI" }: { className?: string; title?: string }) {
  return (
    <span
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      className={cn("inline-block aspect-[755/992] shrink-0 bg-current", className)}
      style={{
        maskImage: "url(/spag-logo-mark.svg)",
        WebkitMaskImage: "url(/spag-logo-mark.svg)",
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
