import { PageLoader } from "@/components/page-loader";

/** Shown while any page outside the signed-in area (sign-in, email links) loads. */
export default function Loading() {
  return <PageLoader fullScreen />;
}
