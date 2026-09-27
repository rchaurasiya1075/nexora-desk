import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { MarketsScreen } from "@/components/app/markets-screen";

export const Route = createFileRoute("/markets")({ component: MarketsPage });

export function MarketsPage() {
  return (
    <AppShell>
      <MarketsScreen />
    </AppShell>
  );
}
