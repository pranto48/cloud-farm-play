import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchMyGames } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameCover } from "@/components/app/game-cover";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/library")({
  head: () => ({ meta: [{ title: "My Games — CloudFarm Arcade" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const { data, isLoading } = useQuery({ queryKey: ["my-games", userId], queryFn: () => fetchMyGames(userId) });
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string>("all");

  const genres = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((g) => g.games.genre && set.add(g.games.genre));
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((g) => {
      const matchesQ = q.trim() === "" || g.games.title.toLowerCase().includes(q.toLowerCase());
      const matchesGenre = genre === "all" || g.games.genre === genre;
      return matchesQ && matchesGenre;
    });
  }, [data, q, genre]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">My Games</h1>
        <p className="text-sm text-muted-foreground">Your personal CloudFarm library.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Genre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genres</SelectItem>
            {genres.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse border-border/60">
              <div className="aspect-[16/10] w-full rounded-t-lg bg-muted" />
              <CardContent className="space-y-2 p-4">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground">No games match your filters.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <Card key={g.id} className="overflow-hidden border-border/60 shadow-[var(--shadow-soft)]">
              <div className="p-3 pb-0"><GameCover slug={g.games.slug} title={g.games.title} /></div>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{g.games.title}</h3>
                  {g.games.genre && <Badge variant="secondary">{g.games.genre}</Badge>}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{g.games.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{g.last_played_at ? `Last played ${format(new Date(g.last_played_at), "MMM d")}` : "Never played"}</span>
                </div>
                <div className="flex gap-2">
                  <Button asChild className="flex-1"><Link to="/play/$slug" params={{ slug: g.games.slug }}>Play</Link></Button>
                  <Button asChild variant="outline"><Link to="/games/$slug" params={{ slug: g.games.slug }}>Details</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
