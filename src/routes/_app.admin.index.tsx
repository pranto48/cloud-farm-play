import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Gamepad2, PlayCircle, Cloud } from "lucide-react";
import { adminFetchAllUsers, adminFetchAllSessions, adminFetchAllSaves, fetchAllGames } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const users = useQuery({ queryKey: ["admin-users"], queryFn: adminFetchAllUsers });
  const games = useQuery({ queryKey: ["admin-games"], queryFn: fetchAllGames });
  const sessions = useQuery({ queryKey: ["admin-sessions"], queryFn: adminFetchAllSessions });
  const saves = useQuery({ queryKey: ["admin-saves"], queryFn: adminFetchAllSaves });
  const stats = [
    { icon: Users, label: "Users", value: users.data?.length ?? 0 },
    { icon: Gamepad2, label: "Games", value: games.data?.length ?? 0 },
    { icon: PlayCircle, label: "Play sessions", value: sessions.data?.length ?? 0 },
    { icon: Cloud, label: "Cloud saves", value: saves.data?.length ?? 0 },
  ];
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/60 shadow-[var(--shadow-soft)]">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></div>
                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>
      <Card className="border-border/60">
        <CardHeader><CardTitle>Recent play sessions</CardTitle></CardHeader>
        <CardContent>
          {(sessions.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(sessions.data ?? []).slice(0, 10).map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <span className="font-mono text-xs">{s.user_id.slice(0, 8)}…</span>
                  <span className="text-muted-foreground">{format(new Date(s.started_at), "MMM d, HH:mm")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}