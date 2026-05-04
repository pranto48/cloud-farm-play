import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cloud, Gamepad2, Library as LibIcon, PlayCircle, Sprout } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchMyGames, fetchPlayStats, fetchAllCloudSaves } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CloudFarm Arcade" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const userId = user!.id;

  const games = useQuery({ queryKey: ["my-games", userId], queryFn: () => fetchMyGames(userId) });
  const stats = useQuery({ queryKey: ["play-stats", userId], queryFn: () => fetchPlayStats(userId) });
  const saves = useQuery({ queryKey: ["all-saves", userId], queryFn: () => fetchAllCloudSaves(userId) });

  const lastPlayed = games.data?.find((g) => g.last_played_at) ?? games.data?.[0];
  const totalGames = games.data?.length ?? 0;
  const totalSaves = saves.data?.length ?? 0;
  const totalSessions = stats.data?.sessions ?? 0;
  const recent = stats.data?.recent ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <header>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-3xl font-bold tracking-tight">{user?.email}</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={LibIcon} label="Total games" value={totalGames} />
        <Stat icon={PlayCircle} label="Play sessions" value={totalSessions} />
        <Stat icon={Cloud} label="Cloud saves" value={totalSaves} />
        <Stat
          icon={Gamepad2}
          label="Last played"
          value={lastPlayed?.games.title ?? "—"}
          small
        />
      </section>

      {lastPlayed && (
        <Card className="overflow-hidden border-border/60 shadow-[var(--shadow-soft)]">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Continue playing</p>
              <h2 className="mt-1 text-2xl font-semibold">{lastPlayed.games.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{lastPlayed.games.description}</p>
            </CardContent>
            <div className="p-6 pt-0 md:pt-6">
              <Button asChild size="lg">
                <Link to="/play/$slug" params={{ slug: lastPlayed.games.slug }}>
                  <Sprout className="mr-2 h-4 w-4" /> Play now
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No play sessions yet. Jump in!</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recent.map((r: { id: string; started_at: string; games: { title: string; slug: string } | null }) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                    <span>{r.games?.title ?? "Game"}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(r.started_at), "MMM d, HH:mm")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Your library</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              {totalGames} {totalGames === 1 ? "game" : "games"} ready to play.
            </p>
            <Button asChild variant="outline">
              <Link to="/library">Open library</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: typeof Cloud;
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-[var(--shadow-soft)]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={small ? "truncate text-base font-semibold" : "text-2xl font-bold"}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}