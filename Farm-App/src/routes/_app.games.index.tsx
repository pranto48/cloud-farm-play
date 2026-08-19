import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { fetchAllGames } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GameCover } from "@/components/app/game-cover";

export const Route = createFileRoute("/_app/games/")({
  head: () => ({ meta: [{ title: "Game List — CloudFarm Arcade" }] }),
  component: GameListPage,
});

function GameListPage() {
  const { data, isLoading } = useQuery({ queryKey: ["all-games"], queryFn: fetchAllGames });
  const [q, setQ] = useState("");
  const filtered = useMemo(() => (data ?? []).filter((g) => g.title.toLowerCase().includes(q.toLowerCase())), [data, q]);
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-10">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Game List</h1>
        <p className="text-sm text-muted-foreground">Browse all games available on CloudFarm Arcade.</p>
      </motion.header>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground">No games yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden border-border/60 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-1">
                <div className="p-3 pb-0"><GameCover slug={g.slug} title={g.title} /></div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{g.title}</h3>
                    {g.genre && <Badge variant="secondary">{g.genre}</Badge>}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1"><Link to="/play/$slug" params={{ slug: g.slug }}>Play</Link></Button>
                    <Button asChild variant="outline"><Link to="/games/$slug" params={{ slug: g.slug }}>Details</Link></Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}