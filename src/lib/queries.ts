import { supabase } from "@/integrations/supabase/client";

export type GameRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  genre: string | null;
  cover_url: string | null;
};

export type UserGameRow = {
  id: string;
  game_id: string;
  added_at: string;
  last_played_at: string | null;
  games: GameRow;
};

export async function fetchMyGames(userId: string): Promise<UserGameRow[]> {
  const { data, error } = await supabase
    .from("user_games")
    .select("id, game_id, added_at, last_played_at, games(id, title, slug, description, genre, cover_url)")
    .eq("user_id", userId)
    .order("last_played_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as UserGameRow[];
}

export async function fetchGameBySlug(slug: string): Promise<GameRow | null> {
  const { data, error } = await supabase.from("games").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCloudSave(userId: string, gameId: string) {
  const { data, error } = await supabase
    .from("cloud_saves")
    .select("*")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllCloudSaves(userId: string) {
  const { data, error } = await supabase
    .from("cloud_saves")
    .select("id, slot_name, updated_at, game_id, games(title, slug, cover_url, genre)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayStats(userId: string) {
  const [{ count: sessions }, { data: lastSession }] = await Promise.all([
    supabase.from("play_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("play_sessions")
      .select("id, started_at, game_id, games(title, slug)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);
  return { sessions: sessions ?? 0, recent: lastSession ?? [] };
}

export async function upsertCloudSave(params: {
  userId: string;
  gameId: string;
  saveData: unknown;
  slotName?: string;
}) {
  const { error } = await supabase
    .from("cloud_saves")
    .upsert(
      {
        user_id: params.userId,
        game_id: params.gameId,
        slot_name: params.slotName ?? "Auto Save",
        save_data: params.saveData as never,
      },
      { onConflict: "user_id,game_id,slot_name" },
    );
  if (error) throw error;
}

export async function deleteCloudSave(id: string) {
  const { error } = await supabase.from("cloud_saves").delete().eq("id", id);
  if (error) throw error;
}

export async function touchLastPlayed(userId: string, gameId: string) {
  await supabase
    .from("user_games")
    .update({ last_played_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("game_id", gameId);
}

export async function startPlaySession(userId: string, gameId: string) {
  const { data, error } = await supabase
    .from("play_sessions")
    .insert({ user_id: userId, game_id: gameId })
    .select("id, started_at")
    .single();
  if (error) throw error;
  return data;
}

export async function endPlaySession(id: string, startedAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  await supabase
    .from("play_sessions")
    .update({ ended_at: new Date().toISOString(), duration_seconds: seconds })
    .eq("id", id);
}

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function fetchAllGames(): Promise<GameRow[]> {
  const { data, error } = await supabase.from("games").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminFetchAllUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminFetchAllSessions() {
  const { data, error } = await supabase
    .from("play_sessions")
    .select("id, user_id, game_id, started_at, ended_at, duration_seconds")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function adminFetchAllUserGames() {
  const { data, error } = await supabase
    .from("user_games")
    .select("id, user_id, game_id, added_at, last_played_at");
  if (error) throw error;
  return data ?? [];
}

export async function adminFetchAllSaves() {
  const { data, error } = await supabase
    .from("cloud_saves")
    .select("id, user_id, game_id, slot_name, updated_at");
  if (error) throw error;
  return data ?? [];
}

export async function adminFetchUserRoles() {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role");
  if (error) throw error;
  return data ?? [];
}

export async function adminCreateGame(game: { title: string; slug: string; description: string; genre: string; cover_url?: string | null }) {
  const { error } = await supabase.from("games").insert(game);
  if (error) throw error;
}

export async function adminDeleteGame(id: string) {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}

export async function adminToggleAdmin(userId: string, makeAdmin: boolean) {
  if (makeAdmin) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (error && !error.message.includes("duplicate")) throw error;
  } else {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    if (error) throw error;
  }
}