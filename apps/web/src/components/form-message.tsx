import { CircleCheck, CircleAlert } from "lucide-react";

/** Inline success / error line under a form (state from a server action). */
export function FormMessage({ state }: { state: { status: string; message?: string } }) {
  if (state.status === "ok") return <p role="status" className="flex items-center gap-1.5 text-sm text-primary"><CircleCheck className="size-4" /> {state.message}</p>;
  if (state.status === "error") return <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive"><CircleAlert className="size-4" /> {state.message}</p>;
  return null;
}
