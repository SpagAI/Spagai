import { cn } from "@/lib/utils";
import { LOGO_PARTS, LOGO_VIEWBOX } from "./spag-logo-parts";

/** Room on each side for the crescents to travel outwards (logo units; the logo is 755 wide). */
const TRAVEL = 90;
const [vx, vy, vw, vh] = LOGO_VIEWBOX;

/**
 * The Spag AI logo as a "sound wave" animation: the S pulses, then the crescents ripple outwards
 * (inner first, outer just after) and settle back into the logo. Used as the loading indicator.
 * It takes the current text colour. With reduced motion turned on, it gently fades instead.
 * The motion itself lives in globals.css (.spag-loader).
 */
export function SpagLoader({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox={`${vx - TRAVEL} ${vy} ${vw + TRAVEL * 2} ${vh}`}
      role="status"
      aria-label={label}
      fill="currentColor"
      className={cn("spag-loader aspect-[935/992] shrink-0", className)}
    >
      <path className="spag-loader-c spag-loader-out spag-loader-left" fillRule="evenodd" d={LOGO_PARTS.leftOuter} />
      <path className="spag-loader-c spag-loader-in spag-loader-left" fillRule="evenodd" d={LOGO_PARTS.leftInner} />
      <path className="spag-loader-s" fillRule="evenodd" d={LOGO_PARTS.s} />
      <path className="spag-loader-c spag-loader-in spag-loader-right" fillRule="evenodd" d={LOGO_PARTS.rightInner} />
      <path className="spag-loader-c spag-loader-out spag-loader-right" fillRule="evenodd" d={LOGO_PARTS.rightOuter} />
    </svg>
  );
}
