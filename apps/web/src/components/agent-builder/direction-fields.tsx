"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DIRECTION_FIELDS, type Direction } from "@/lib/agent-direction";

/**
 * "Calls: outbound / inbound" plus that kind's own business questions. Used inside a form:
 * the choice is sent as `direction` and each answer as `detail_<name>`.
 */
export function DirectionFields({ requiredFields = true, value, onChange, details, onDetailsChange }: {
  /** Quick start: the starting prompt uses these, so the main ones are required. */
  requiredFields?: boolean;
  /** Controlled use (Custom form); leave out inside a plain form. */
  value?: Direction;
  onChange?: (d: Direction) => void;
  details?: Record<string, string>;
  onDetailsChange?: (d: Record<string, string>) => void;
}) {
  const [own, setOwn] = useState<Direction>("outbound");
  const direction = value ?? own;
  const setDirection = (d: Direction) => (onChange ? onChange(d) : setOwn(d));
  const fields = DIRECTION_FIELDS[direction].filter((v) => v.scope === "agent");
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="agent-direction">Calls</Label>
        <Select id="agent-direction" name="direction" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
          <option value="outbound">It calls customers (outbound)</option>
          <option value="inbound">It answers calls (inbound)</option>
        </Select>
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3 md:col-span-2">
        <p className="text-xs font-medium text-muted-foreground">
          {direction === "outbound" ? "About the calls it makes" : "About your business, for callers"}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((v) => {
            const required = requiredFields && v.required;
            return (
              <div key={`${direction}-${v.name}`} className="space-y-1.5">
                <Label htmlFor={`detail-${v.name}`}>
                  {v.label}
                  {required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
                </Label>
                <Input
                  id={`detail-${v.name}`}
                  name={`detail_${v.name}`}
                  required={required}
                  maxLength={500}
                  placeholder={v.example ? `e.g. ${v.example}` : undefined}
                  {...(details ? { value: details[v.name] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onDetailsChange?.({ ...details, [v.name]: e.target.value }) } : {})}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
