"use client";

import {
  DEFAULT_GUARDRAILS,
  extractScriptedLines,
  lintSpokenLine,
  PART_ORDER,
  SECTION_ORDER,
  type BlockPart,
  type PromptBlock,
} from "@spagai/core";
import { ArrowDown, ArrowUp, Lock, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { newBlockId, PARTS_FOR_SECTION } from "./shared";

const rank = (p: BlockPart | undefined) => PART_ORDER.indexOf(p ?? "main");

interface Props {
  blocks: PromptBlock[];
  onChange: (blocks: PromptBlock[]) => void;
}

export function BlocksEditor({ blocks, onChange }: Props) {
  const t = useT();

  const patch = (id: string, change: Partial<PromptBlock>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...change } : b)));

  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));

  const swap = (a: string, b: string) => {
    const i = blocks.findIndex((x) => x.id === a);
    const j = blocks.findIndex((x) => x.id === b);
    const next = [...blocks];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  const add = (section: PromptBlock["section"]) => {
    const part = PARTS_FOR_SECTION[section][0]!;
    onChange([...blocks, { id: newBlockId(), section, part, title: t("builder.blocks.newTitle"), content: "" }]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("builder.blocks.intro")}</p>
      {SECTION_ORDER.map((section) => {
        const inSection = blocks
          .map((b, index) => ({ b, index }))
          .filter(({ b }) => b.section === section)
          .sort((x, y) => rank(x.b.part) - rank(y.b.part) || x.index - y.index)
          .map(({ b }) => b);

        return (
          <Card key={section} className="gap-3">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{t(`builder.sections.${section}`)}</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => add(section)}>
                <Plus /> {t("builder.blocks.add")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {inSection.map((block, i) => {
                const prev = inSection[i - 1];
                const next = inSection[i + 1];
                const samePart = (other?: PromptBlock) => other && (other.part ?? "main") === (block.part ?? "main");
                return (
                  <BlockCard
                    key={block.id}
                    block={block}
                    partOptions={PARTS_FOR_SECTION[section]}
                    onChange={(c) => patch(block.id, c)}
                    onRemove={() => remove(block.id)}
                    onMoveUp={samePart(prev) ? () => swap(block.id, prev!.id) : undefined}
                    onMoveDown={samePart(next) ? () => swap(block.id, next!.id) : undefined}
                  />
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface BlockCardProps {
  block: PromptBlock;
  partOptions: BlockPart[];
  onChange: (change: Partial<PromptBlock>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function BlockCard({ block, partOptions, onChange, onRemove, onMoveUp, onMoveDown }: BlockCardProps) {
  const t = useT();
  const locked = Boolean(block.guardrail);
  const enabled = block.enabled !== false;
  const lineIssues = extractScriptedLines(block.content).flatMap((l) => lintSpokenLine(l.text));
  const rows = Math.min(14, Math.max(3, Math.ceil(block.content.length / 70) + 1));

  return (
    <div className={cn("space-y-2 rounded-lg border p-3", locked && "border-primary/40 bg-primary/5", !enabled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        {locked ? (
          <div className="flex flex-1 items-center gap-2">
            <Lock className="size-4 text-primary" />
            <span className="text-sm font-medium">{block.title}</span>
            <Badge variant="outline" title={t("builder.blocks.lockedHelp")}>{t("builder.blocks.locked")}</Badge>
          </div>
        ) : (
          <Input
            aria-label={t("builder.blocks.title")}
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="h-8 min-w-40 flex-1 font-medium"
          />
        )}
        {!locked && partOptions.length > 1 && (
          <Select
            aria-label={t("builder.blocks.part")}
            value={block.part ?? partOptions[0]}
            onChange={(e) => onChange({ part: e.target.value as BlockPart })}
            className="h-8 w-auto"
          >
            {partOptions.map((p) => (
              <option key={p} value={p}>{t(`builder.parts.${p}`)}</option>
            ))}
          </Select>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!locked && (
            <>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t("builder.blocks.moveUp")} disabled={!onMoveUp} onClick={onMoveUp}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t("builder.blocks.moveDown")} disabled={!onMoveDown} onClick={onMoveDown}>
                <ArrowDown />
              </Button>
              <Switch checked={enabled} onCheckedChange={(v) => onChange({ enabled: v })} aria-label={t("builder.blocks.enabled")} />
              <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" aria-label={t("builder.blocks.remove")} onClick={onRemove}>
                <Trash2 />
              </Button>
            </>
          )}
          {locked && block.guardrail && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ content: DEFAULT_GUARDRAILS[block.guardrail!].content })}>
              <RotateCcw /> {t("builder.blocks.resetGuardrail")}
            </Button>
          )}
        </div>
      </div>
      <Textarea
        aria-label={`${block.title}: ${t("builder.blocks.content")}`}
        value={block.content}
        rows={rows}
        onChange={(e) => onChange({ content: e.target.value })}
      />
      {lineIssues.length > 0 && (
        <ul className="space-y-1">
          {lineIssues.map((issue, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
