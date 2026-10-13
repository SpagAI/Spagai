import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:float-left [&>svg]:mr-2 [&>svg]:size-4 [&>svg]:translate-y-0.5", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      destructive: "border-destructive/40 bg-destructive/5 text-destructive",
      warning: "border-warning/50 bg-warning/10",
      success: "border-primary/40 bg-primary/5",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
