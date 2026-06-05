import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Cloud, Maximize2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  fetchGameBySlug,
  fetchCloudSave,
  upsertCloudSave,
  touchLastPlayed,
  startPlaySession,
  endPlaySession,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MeadowLife } from "@/game/MeadowLife";
import { newGame, migrateState, type GameState } from "@/game/meadow-life";

export const Route = createFileRoute("/_app/play/$slug")({
  head: () => ({ meta: [{ title: "Play — CloudFarm Arcade" }] }),
  component: PlayPage,
});

type SaveStatus = "idle" | "saving" | "saved" | "error";

function PlayPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Guard: user must be authenticated — the _app layout should ensure this,
  // but add a safety net to prevent a runtime crash on production.
  if (!user) {
    return <LaunchScreen title="Authenticating…" />;
  }
  const userId = user.id;

  const game = useQuery({ queryKey: ["game", slug], queryFn: () => fetchGameBySlug(slug) });
  const save = useQuery({
    queryKey: ["cloud-save", userId, game.data?.id],
    queryFn: () => fetchCloudSave(userId, game.data!.id),
    enabled: !!game.data?.id,
  });


  const [chosen, setChosen] = useState<GameState | null>(null);
  const [askResume, setAskResume] = useState(false);
  const stateRef = useRef<GameState | null>(null);
  const dirtyRef = useRef(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Decide whether to ask resume vs new
  useEffect(() => {
    if (!game.data || save.isLoading) return;
    if (chosen) return;
    if (save.data) {
      setAskResume(true);
    } else {
      setChosen(newGame());
    }
  }, [game.data, save.data, save.isLoading, chosen]);

  // Play session lifecycle
  useEffect(() => {
    if (!game.data || !chosen) return;
    let sessionId: string | null = null;
    let startedAt: string | null = null;
    (async () => {
      try {
        const s = await startPlaySession(userId, game.data!.id);
        sessionId = s.id;
        startedAt = s.started_at;
      } catch {
        /* ignore */
      }
    })();
    return () => {
      if (sessionId && startedAt) endPlaySession(sessionId, startedAt).catch(() => {});
    };
  }, [game.data, chosen, userId]);

  async function doSave(state: GameState, opts?: { silent?: boolean }) {
    if (!game.data) return;
    setStatus("saving");
    try {
      await upsertCloudSave({
        userId,
        gameId: game.data.id,
        saveData: state as unknown,
      });
      await touchLastPlayed(userId, game.data.id);
      dirtyRef.current = false;
      setStatus("saved");
      if (!opts?.silent) toast.success("Game saved to cloud");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (e) {
      setStatus("error");
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  // Auto-save loop
  useEffect(() => {
    if (!chosen) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      if (!dirtyRef.current) return;
      const s = stateRef.current;
      if (s) doSave(s, { silent: true });
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, game.data?.id]);

  function handleStateChange(s: GameState) {
    stateRef.current = s;
    dirtyRef.current = true;
  }

  function manualSave() {
    const s = stateRef.current;
    if (!s) return;
    doSave(s);
  }

  async function loadFromCloud() {
    if (!game.data) return;
    const fresh = await fetchCloudSave(userId, game.data.id);
    if (fresh?.save_data) {
      setChosen(migrateState(fresh.save_data));
      toast.success("Loaded cloud save");
    } else {
      toast.error("No cloud save found");
    }
  }

  function fullscreen() {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  if (game.isLoading || save.isLoading) {
    return <LaunchScreen title={game.data?.title ?? "Loading"} />;
  }
  if (!game.data) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Game not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/library">Back to library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/library" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Library
          </Button>
          <span className="font-semibold">{game.data.title}</span>
          <SaveBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadFromCloud}>
            <RotateCcw className="mr-1 h-4 w-4" /> Load
          </Button>
          <Button size="sm" onClick={manualSave}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={fullscreen}>
            <Maximize2 className="mr-1 h-4 w-4" /> Fullscreen
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 md:p-8">
        {chosen ? (
          slug === "meadow-life" ? (
            <MeadowLife initialState={chosen} onStateChange={handleStateChange} />
          ) : (
            <div className="rounded-lg border border-dashed p-10 text-muted-foreground">
              This game isn't playable yet.
            </div>
          )
        ) : (
          <LaunchScreen title={game.data.title} />
        )}
      </main>

      <Dialog open={askResume} onOpenChange={setAskResume}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Continue from cloud save?</DialogTitle>
            <DialogDescription>
              We found a cloud save for this game. Would you like to keep playing where you left off?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setChosen(newGame());
                setAskResume(false);
                toast("Started a new game");
              }}
            >
              Start new game
            </Button>
            <Button
              onClick={() => {
                setChosen(migrateState(save.data?.save_data ?? newGame()));
                setAskResume(false);
              }}
            >
              <Cloud className="mr-2 h-4 w-4" /> Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map: Record<Exclude<SaveStatus, "idle">, { label: string; cls: string }> = {
    saving: { label: "Saving…", cls: "bg-muted text-foreground" },
    saved: { label: "Saved ✓", cls: "bg-primary/15 text-primary" },
    error: { label: "Save error", cls: "bg-destructive/15 text-destructive" },
  };
  const v = map[status];
  return <Badge className={v.cls + " ml-2 border-0"}>{v.label}</Badge>;
}

function LaunchScreen({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-lg font-semibold">Launching {title}…</p>
        <p className="mt-2 text-sm text-muted-foreground">Tip: keep your crops watered every day.</p>
      </div>
    </div>
  );
}