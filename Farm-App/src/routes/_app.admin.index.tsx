import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Gamepad2, PlayCircle, Cloud, TrendingUp, Clock, ArrowRight, Shield } from "lucide-react";
import { adminFetchAllUsers, adminFetchAllSessions, adminFetchAllSaves, fetchAllGames } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminOverview,
});

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subtitle?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
    >
      <Card className="border-border/60 shadow-[var(--shadow-soft)] hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold leading-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AdminOverview() {
  const users = useQuery({ queryKey: ["admin-users"], queryFn: adminFetchAllUsers });
  const games = useQuery({ queryKey: ["admin-games"], queryFn: fetchAllGames });
  const sessions = useQuery({ queryKey: ["admin-sessions"], queryFn: adminFetchAllSessions });
  const saves = useQuery({ queryKey: ["admin-saves"], queryFn: adminFetchAllSaves });

  const recentSessions = (sessions.data ?? []).slice(0, 8);
  const recentUsers = (users.data ?? []).slice(0, 5);

  const totalPlayTime = (sessions.data ?? []).reduce((acc: number, s: any) => {
    return acc + (s.duration_seconds ?? 0);
  }, 0);
  const hoursPlayed = Math.round(totalPlayTime / 3600);

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={users.data?.length ?? "—"} subtitle="registered accounts" color="bg-blue-500/10 text-blue-600 dark:text-blue-400" delay={0} />
        <StatCard icon={Gamepad2} label="Games" value={games.data?.length ?? "—"} subtitle="in the catalog" color="bg-green-500/10 text-green-600 dark:text-green-400" delay={0.05} />
        <StatCard icon={PlayCircle} label="Play Sessions" value={sessions.data?.length ?? "—"} subtitle={`${hoursPlayed}h total playtime`} color="bg-purple-500/10 text-purple-600 dark:text-purple-400" delay={0.1} />
        <StatCard icon={Cloud} label="Cloud Saves" value={saves.data?.length ?? "—"} subtitle="save files stored" color="bg-orange-500/10 text-orange-600 dark:text-orange-400" delay={0.15} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Recent Users */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/60 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Recent Users</CardTitle>
                <CardDescription>Newest accounts registered</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/users" className="flex items-center gap-1 text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No users yet.</p>
              ) : (
                recentUsers.map((u: any, i: number) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.display_name ?? "Unnamed"}</p>
                      <p className="font-mono text-xs text-muted-foreground">{u.id.slice(0, 12)}…</p>
                    </div>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {u.created_at ? formatDistanceToNow(new Date(u.created_at), { addSuffix: true }) : "—"}
                    </span>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Play Sessions */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-border/60 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Recent Play Sessions
                </CardTitle>
                <CardDescription>Latest game activity across all users</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No sessions yet.</p>
              ) : (
                recentSessions.map((s: any, i: number) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.03 }}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <PlayCircle className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{s.game_id}</p>
                        <p className="font-mono text-xs text-muted-foreground">{s.user_id?.slice(0, 10)}…</p>
                      </div>
                    </div>
                    <div className="ml-2 shrink-0 text-right">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {s.started_at ? format(new Date(s.started_at), "MMM d, HH:mm") : "—"}
                      </div>
                      {s.duration_seconds != null && (
                        <Badge variant="secondary" className="mt-0.5 text-xs">
                          {Math.round(s.duration_seconds / 60)}m
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Quick Actions
            </CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="default" size="sm">
              <Link to="/admin/users" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Manage Users
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/games" className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" /> Manage Games
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/games" className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4" /> Browse Game Catalog
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}