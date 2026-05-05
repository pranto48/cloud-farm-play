import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { fetchAllGames, adminCreateGame, adminDeleteGame } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin/games")({
  component: AdminGames,
});

function AdminGames() {
  const qc = useQueryClient();
  const games = useQuery({ queryKey: ["admin-games"], queryFn: fetchAllGames });
  const [form, setForm] = useState({ title: "", slug: "", description: "", genre: "", cover_url: "" });
  const create = useMutation({
    mutationFn: () => adminCreateGame({ ...form, cover_url: form.cover_url || null }),
    onSuccess: () => { toast.success("Game added"); setForm({ title: "", slug: "", description: "", genre: "", cover_url: "" }); qc.invalidateQueries({ queryKey: ["admin-games"] }); qc.invalidateQueries({ queryKey: ["all-games"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminDeleteGame(id),
    onSuccess: () => { toast.success("Game deleted"); qc.invalidateQueries({ queryKey: ["admin-games"] }); qc.invalidateQueries({ queryKey: ["all-games"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add new game</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} /></div>
            <div className="space-y-1"><Label>Genre</Label><Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} /></div>
            <div className="space-y-1"><Label>Cover URL</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://…" /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Button className="w-full" disabled={create.isPending || !form.title || !form.slug} onClick={() => create.mutate()}>{create.isPending ? "Adding…" : "Add game"}</Button>
          </CardContent>
        </Card>
      </motion.div>
      <div className="space-y-3">
        {(games.data ?? []).map((g, i) => (
          <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="border-border/60">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h3 className="font-semibold">{g.title}</h3>{g.genre && <Badge variant="secondary">{g.genre}</Badge>}</div>
                  <p className="text-xs text-muted-foreground">/{g.slug}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                </div>
                <Button variant="outline" size="sm" disabled={del.isPending} onClick={() => { if (confirm(`Delete "${g.title}"?`)) del.mutate(g.id); }}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {games.data?.length === 0 && <p className="text-sm text-muted-foreground">No games yet.</p>}
      </div>
    </div>
  );
}