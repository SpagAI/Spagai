import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/server";

const AREAS: Record<string, string> = {
  voices: "M3", simulator: "M3", leads: "M4", campaigns: "M4", calls: "M4", billing: "M5",
};

export default async function ComingSoon({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  const milestone = AREAS[area];
  if (!milestone) notFound();
  const t = await getT();
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{t(`nav.${area}`)}</CardTitle>
        <CardDescription>{t("nav.comingSoon")}: {milestone}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">This area is planned for milestone {milestone}.</CardContent>
    </Card>
  );
}
