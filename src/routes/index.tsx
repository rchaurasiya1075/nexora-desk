import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { HomeScreen } from "@/components/app/home-screen";

export const Route = createFileRoute("/")({ component: Home });

export function Home() {
  return (
    <AppShell>
      <HomeScreen />
    </AppShell>
  );
}
