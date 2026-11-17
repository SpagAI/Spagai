import type { Metadata } from "next";
import { ShipBell } from "./ship-bell";

export const metadata: Metadata = { title: "Ship bell" };

/** Keep this open on a desktop: it chimes when a new update of the studio goes live. */
export default function ShipBellPage() {
  return <ShipBell />;
}
