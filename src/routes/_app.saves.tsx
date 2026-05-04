import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Cloud, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchAllCloudSaves, deleteCloudSave } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/saves")({
  head: () => ({ meta: [{ title: "Cloud Saves — CloudFarm Arcade" }] }),
  component: SavesPage,
});

type Save = { id: string; slot_name: string; updated_at: string; game_id: string; games: { title: string; slug: string; genre: string | null; cover_url: string | null } | null };

function SavesPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["all-saves", userId], queryFn: () => fetchAllCloudSaves(userId) as unknown as Promise<Save[]> });
  const del = useMutation({
    mutationFn: (id: string) => deleteCloudSave(id),
    onSuccess: () => { toast.success("Save deleted"); qc.invalidateQueries({ queryKey: ["all-saves"] }); qc.invalidateQueries({ queryKey: ["cloud-save"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Cloud Saves</h1>
        <p className="text-sm text-muted-foreground">All your saved games, across every device.</p>
      </header>
      {isLoading ? (<p className="text-muted-foreground">Loading…</p>) : !data || data.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center"><Cloud className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">No cloud saves yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((s) => (
            <Card key={s.id} className="border-border/60">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2"><h3 className="font-semibold">{s.games?.title ?? "Game"}</h3>{s.games?.genre && <Badge variant="secondary">{s.games.genre}</Badge>}</div>
                  <p className="text-xs text-muted-foreground">{s.slot_name} · saved {format(new Date(s.updated_at), "PPP p")}</p>
                </div>
                <div className="flex gap-2">
                  {s.games?.slug && (<Button asChild size="sm"><Link to="/play/$slug" params={{ slug: s.games.slug }}>Resume</Link></Button>)}
                  <Button size="sm" variant="outline" onClick={() => del.mutate(s.id)} disabled={del.isPending}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
