import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  addDoc
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export type GameRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  genre: string | null;
  cover_url: string | null;
  created_at?: string;
};

export type UserGameRow = {
  id: string;
  game_id: string;
  added_at: string;
  last_played_at: string | null;
  games: GameRow;
};

export async function fetchMyGames(userId: string): Promise<UserGameRow[]> {
  const q = query(collection(db, "user_games"), where("user_id", "==", userId));
  const snap = await getDocs(q);
  let userGames = snap.docs.map(d => d.data());

  const hasMeadow = userGames.some((ug: any) => ug.game_id === "meadow-life");
  if (!hasMeadow && userId && userId !== "undefined") {
    try {
      const userGameId = `${userId}_meadow-life`;
      const userGameRef = doc(db, "user_games", userGameId);
      const defaultUserGame = {
        id: userGameId,
        user_id: userId,
        game_id: "meadow-life",
        added_at: new Date().toISOString(),
        last_played_at: null
      };
      await setDoc(userGameRef, defaultUserGame);
      userGames.push(defaultUserGame);
    } catch (err) {
      console.warn("[Firebase] Auto-provisioning user game meadow-life failed:", err);
    }
  }

  const results = await Promise.all(userGames.map(async (ug: any) => {
    const gameSnap = await getDoc(doc(db, "games", ug.game_id));
    const gameData = gameSnap.exists() 
      ? (gameSnap.data() as GameRow)
      : { id: ug.game_id, title: ug.game_id, slug: ug.game_id, description: "", genre: "", cover_url: null };

    return {
      id: ug.id,
      game_id: ug.game_id,
      added_at: ug.added_at,
      last_played_at: ug.last_played_at || null,
      games: gameData
    };
  }));

  return results.sort((a: any, b: any) => {
    if (!a.last_played_at) return 1;
    if (!b.last_played_at) return -1;
    return new Date(b.last_played_at).getTime() - new Date(a.last_played_at).getTime();
  }) as UserGameRow[];
}

export async function fetchGameBySlug(slug: string): Promise<GameRow | null> {
  const docSnap = await getDoc(doc(db, "games", slug));
  if (docSnap.exists()) return docSnap.data() as GameRow;

  if (slug === "meadow-life") {
    try {
      const meadowRef = doc(db, "games", "meadow-life");
      const defaultGame: GameRow = {
        id: "meadow-life",
        title: "Meadow Life",
        slug: "meadow-life",
        description: "A cozy original farming demo. Till soil, plant seeds, water crops, and watch your meadow grow.",
        genre: "Cozy Farming RPG",
        cover_url: null,
        created_at: new Date().toISOString()
      };
      await setDoc(meadowRef, defaultGame);
      return defaultGame;
    } catch (err) {
      console.warn("[Firebase] Seeding meadow-life on fetchGameBySlug failed:", err);
    }
  }

  const q = query(collection(db, "games"), where("slug", "==", slug));
  const qSnap = await getDocs(q);
  if (!qSnap.empty) return qSnap.docs[0].data() as GameRow;

  return null;
}

export async function fetchCloudSave(userId: string, gameId: string) {
  const q = query(
    collection(db, "cloud_saves"), 
    where("user_id", "==", userId), 
    where("game_id", "==", gameId)
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map(d => d.data());
  if (docs.length === 0) return null;

  docs.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return docs[0];
}

export async function fetchAllCloudSaves(userId: string) {
  const q = query(collection(db, "cloud_saves"), where("user_id", "==", userId));
  const snap = await getDocs(q);
  const saves = snap.docs.map(d => d.data());

  const results = await Promise.all(saves.map(async (s: any) => {
    const gameSnap = await getDoc(doc(db, "games", s.game_id));
    const gameData = gameSnap.exists()
      ? gameSnap.data()
      : { title: s.game_id, slug: s.game_id, cover_url: null, genre: "" };
    
    return {
      id: s.id,
      slot_name: s.slot_name,
      updated_at: s.updated_at,
      game_id: s.game_id,
      games: gameData
    };
  }));

  return results.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function fetchPlayStats(userId: string) {
  const q = query(collection(db, "play_sessions"), where("user_id", "==", userId));
  const snap = await getDocs(q);
  const sessions = snap.docs.map(d => d.data());
  const sorted = [...sessions].sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  const recentWithGames = await Promise.all(sorted.slice(0, 5).map(async (s: any) => {
    const gameSnap = await getDoc(doc(db, "games", s.game_id));
    const gameData = gameSnap.exists() 
      ? gameSnap.data() 
      : { title: s.game_id, slug: s.game_id };

    return {
      id: s.id,
      started_at: s.started_at,
      game_id: s.game_id,
      games: gameData
    };
  }));

  return {
    sessions: sessions.length,
    recent: recentWithGames
  };
}

export async function upsertCloudSave(params: {
  userId: string;
  gameId: string;
  saveData: unknown;
  slotName?: string;
}) {
  const slot = params.slotName ?? "Auto Save";
  if (!params.userId || params.userId === "undefined") {
    console.warn("[Firebase] upsertCloudSave: userId is missing or invalid, skipping save.", params);
    return;
  }
  const docId = `${params.userId}_${params.gameId}_${slot.replace(/\s+/g, "_")}`;
  const saveRef = doc(db, "cloud_saves", docId);
  
  await setDoc(saveRef, {
    id: docId,
    user_id: params.userId,
    game_id: params.gameId,
    slot_name: slot,
    save_data: params.saveData,
    updated_at: new Date().toISOString()
  }, { merge: true });
}

export async function deleteCloudSave(id: string) {
  await deleteDoc(doc(db, "cloud_saves", id));
}

export async function touchLastPlayed(userId: string, gameId: string) {
  if (!userId || userId === "undefined") {
    console.warn("[Firebase] touchLastPlayed: userId is missing or invalid, skipping.", { userId, gameId });
    return;
  }
  const docId = `${userId}_${gameId}`;
  await setDoc(doc(db, "user_games", docId), {
    last_played_at: new Date().toISOString()
  }, { merge: true });
}

export async function startPlaySession(userId: string, gameId: string) {
  if (!userId || userId === "undefined") {
    console.warn("[Firebase] startPlaySession: userId is missing or invalid, skipping session start.", { userId, gameId });
    return { id: "temp_session", started_at: new Date().toISOString() };
  }
  const docRef = doc(collection(db, "play_sessions"));
  const startedAt = new Date().toISOString();
  await setDoc(docRef, {
    id: docRef.id,
    user_id: userId,
    game_id: gameId,
    started_at: startedAt,
    ended_at: null,
    duration_seconds: null
  });
  return { id: docRef.id, started_at: startedAt };
}

export async function endPlaySession(id: string, startedAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  await updateDoc(doc(db, "play_sessions", id), {
    ended_at: new Date().toISOString(),
    duration_seconds: seconds
  });
}

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const docSnap = await getDoc(doc(db, "user_roles", userId));
  if (!docSnap.exists()) return false;
  return docSnap.data().role === "admin";
}

export async function fetchAllGames(): Promise<GameRow[]> {
  const snap = await getDocs(collection(db, "games"));
  let games = snap.docs.map(d => d.data() as GameRow);

  const hasMeadow = games.some(g => g.id === "meadow-life" || g.slug === "meadow-life");
  if (!hasMeadow) {
    try {
      const meadowRef = doc(db, "games", "meadow-life");
      const defaultGame: GameRow = {
        id: "meadow-life",
        title: "Meadow Life",
        slug: "meadow-life",
        description: "A cozy original farming demo. Till soil, plant seeds, water crops, and watch your meadow grow.",
        genre: "Cozy Farming RPG",
        cover_url: null,
        created_at: new Date().toISOString()
      };
      await setDoc(meadowRef, defaultGame);
      games.push(defaultGame);
    } catch (err) {
      console.warn("[Firebase] Seeding meadow-life on fetchAllGames failed:", err);
    }
  }

  return games.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export async function adminFetchAllUsers() {
  const snap = await getDocs(collection(db, "profiles"));
  const users = snap.docs.map(d => d.data());
  return users.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export async function adminFetchAllSessions() {
  const snap = await getDocs(collection(db, "play_sessions"));
  const sessions = snap.docs.map(d => d.data());
  return sessions
    .sort((a: any, b: any) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())
    .slice(0, 50);
}

export async function adminFetchAllUserGames() {
  const snap = await getDocs(collection(db, "user_games"));
  return snap.docs.map(d => d.data());
}

export async function adminFetchAllSaves() {
  const snap = await getDocs(collection(db, "cloud_saves"));
  return snap.docs.map(d => d.data());
}

export async function adminFetchUserRoles() {
  const snap = await getDocs(collection(db, "user_roles"));
  return snap.docs.map(d => d.data());
}

export async function adminCreateGame(game: { title: string; slug: string; description: string; genre: string; cover_url?: string | null }) {
  await setDoc(doc(db, "games", game.slug), {
    id: game.slug,
    title: game.title,
    slug: game.slug,
    description: game.description,
    genre: game.genre,
    cover_url: game.cover_url || null,
    created_at: new Date().toISOString()
  });
}

export async function adminDeleteGame(id: string) {
  await deleteDoc(doc(db, "games", id));
}

export async function adminToggleAdmin(userId: string, makeAdmin: boolean) {
  await setDoc(doc(db, "user_roles", userId), {
    user_id: userId,
    role: makeAdmin ? "admin" : "user",
    created_at: new Date().toISOString()
  }, { merge: true });
}