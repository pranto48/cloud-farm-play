import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Cloud, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { fetchGameBySlug, fetchCloudSave, deleteCloudSave } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameCover } from "@/components/app/game-cover";

export const Route = createFileRoute("/_app/games/$slug")({
  head: () => ({ meta: [{ title: "Game — CloudFarm Arcade" }] }),
  component: GameDetails,
});

function GameDetails() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();
  const game = useQuery({ queryKey: ["game", slug], queryFn: () => fetchGameBySlug(slug) });
  const save = useQuery({
    queryKey: ["cloud-save", userId, game.data?.id],
    queryFn: () => fetchCloudSave(userId, game.data!.id),
    enabled: !!game.data?.id,
  });
  const del = useMutation({
    mutationFn: () => deleteCloudSave(save.data!.id),
    onSuccess: () => { toast.success("Cloud save deleted"); qc.invalidateQueries({ queryKey: ["cloud-save"] }); qc.invalidateQueries({ queryKey: ["all-saves"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (game.isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!game.data) return <div className="p-10">Not found.</div>;
  const g = game.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <Button asChild variant="ghost" size="sm"><Link to="/library"><ArrowLeft className="mr-2 h-4 w-4" /> Back to library</Link></Button>
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div>
          <GameCover slug={g.slug} title={g.title} className="!aspect-[16/9]" />
          <div className="mt-4 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => (<div key={i} className="aspect-[4/3] rounded-md bg-muted" aria-hidden />))}</div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            {g.genre && <Badge variant="secondary">{g.genre}</Badge>}
            <h1 className="text-3xl font-bold tracking-tight">{g.title}</h1>
            <p className="text-muted-foreground">{g.description}</p>
          </div>
          <Button asChild size="lg"><Link to="/play/$slug" params={{ slug: g.slug }}>Play now</Link></Button>
          <Card className="border-border/60">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-4 w-4" /> Cloud save</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {save.data ? (
                <>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Slot</span><span className="font-medium">{save.data.slot_name}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Last saved</span><span>{format(new Date(save.data.updated_at), "PPP p")}</span></div>
                  <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => del.mutate()} disabled={del.isPending}><Trash2 className="mr-2 h-4 w-4" /> Delete save</Button>
                </>
              ) : (<p className="text-muted-foreground">No cloud save yet. Start playing to create one.</p>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
