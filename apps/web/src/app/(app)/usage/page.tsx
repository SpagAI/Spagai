import { redirect } from "next/navigation";

/** Usage now lives on the Billing page (Billing | Usage). */
export default function UsagePage() {
  redirect("/billing?tab=usage");
}
