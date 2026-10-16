"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** A submit button that asks "Are you sure?" first. Put it inside a <form action={…}>. */
export function ConfirmButton({ confirm, children, pendingText, ...props }: React.ComponentProps<typeof Button> & { confirm: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      onClick={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}
      {...props}
    >
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

/** A select that saves as soon as it changes. Put it inside a <form action={…}>. */
export function AutoSubmitSelect(props: React.ComponentProps<"select">) {
  const { pending } = useFormStatus();
  return <select {...props} disabled={pending || props.disabled} onChange={(e) => { props.onChange?.(e); e.currentTarget.form?.requestSubmit(); }} />;
}

/** A submit button that shows a "working" label while its form is being sent. */
export function PendingButton({ children, pendingText, ...props }: React.ComponentProps<typeof Button> & { pendingText: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={pending || props.disabled}>{pending ? pendingText : children}</Button>;
}
