import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Trash2, Plus, Gamepad2, RefreshCw, ExternalLink } from "lucide-react";
import { fetchAllGames, adminCreateGame, adminDeleteGame } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/games")({
  component: AdminGames,
});

const emptyForm = { title: "", slug: "", description: "", genre: "", cover_url: "" };

function GenreColor(genre: string) {
  const map: Record<string, string> = {
    "Cozy Farming RPG": "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
    "Action": "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    "Puzzle": "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
    "Strategy": "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30",
    "Adventure": "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  };
  return map[genre] ?? "bg-muted text-muted-foreground";
}

function AdminGames() {
  const qc = useQueryClient();
  const games = useQuery({ queryKey: ["admin-games"], queryFn: fetchAllGames });
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => adminCreateGame({ ...form, cover_url: form.cover_url || null }),
    onSuccess: () => {
      toast.success(`"${form.title}" added to catalog`);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin-games"] });
      qc.invalidateQueries({ queryKey: ["all-games"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminDeleteGame(id),
    onSuccess: (_, id) => {
      toast.success("Game removed from catalog");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["admin-games"] });
      qc.invalidateQueries({ queryKey: ["all-games"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isFormValid = form.title.trim() !== "" && form.slug.trim() !== "";

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Create Form */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <Card className="border-border/60 sticky top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Add New Game
            </CardTitle>
            <CardDescription>Add a new game to the CloudFarm catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="game-title">Title <span className="text-red-500">*</span></Label>
              <Input
                id="game-title"
                placeholder="Meadow Life"
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm({
                    ...form,
                    title,
                    slug: form.slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                  });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-slug">Slug (URL) <span className="text-red-500">*</span></Label>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-sm text-muted-foreground">/play/</span>
                <Input
                  id="game-slug"
                  placeholder="meadow-life"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-genre">Genre</Label>
              <Input
                id="game-genre"
                placeholder="Cozy Farming RPG"
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-cover">Cover Image URL</Label>
              <Input
                id="game-cover"
                placeholder="https://example.com/cover.jpg"
                value={form.cover_url}
                onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="game-desc">Description</Label>
              <Textarea
                id="game-desc"
                placeholder="A short description of the game…"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={create.isPending || !isFormValid}
              onClick={() => create.mutate()}
            >
              {create.isPending ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Adding…</>
              ) : (
                <><Plus className="mr-2 h-4 w-4" /> Add Game</>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Game List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            {games.data?.length ?? 0} game{games.data?.length !== 1 ? "s" : ""} in catalog
          </h2>
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-games"] })}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <AnimatePresence>
          {(games.data ?? []).map((g: any, i: number) => (
            <motion.div
              key={g.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="border-border/60 group hover:border-primary/30 transition-colors">
                <CardContent className="flex items-start gap-4 p-4">
                  {/* Cover thumbnail */}
                  <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    {g.cover_url ? (
                      <img src={g.cover_url} alt={g.title} className="h-full w-full object-cover" />
                    ) : (
                      <Gamepad2 className="h-7 w-7 opacity-60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{g.title}</h3>
                      {g.genre && (
                        <Badge variant="outline" className={cn("text-xs", GenreColor(g.genre))}>
                          {g.genre}
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">/play/{g.slug}</p>
                    {g.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <a href={`/play/${g.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    {confirmDelete === g.id ? (
                      <div className="flex gap-1.5">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={del.isPending}
                          onClick={() => del.mutate(g.id)}
                        >
                          {del.isPending ? "…" : "Delete"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-red-200 text-red-600 hover:bg-red-500/10 hover:border-red-400 dark:border-red-900"
                        onClick={() => setConfirmDelete(g.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {games.data?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No games in the catalog yet. Add one using the form.
          </p>
        )}
      </div>
    </div>
  );
}