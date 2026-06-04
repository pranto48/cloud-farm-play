import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, seedDefaultGames } from "@/integrations/firebase/client";
import { fetchIsAdmin } from "@/lib/queries";

type AuthContextValue = {
  user: User | null;
  session: { user: User } | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Run self-healing database seeding & user registration checks
        await seedDefaultGames();
        await ensureUserProfile(firebaseUser);
        
        try {
          const adminStatus = await fetchIsAdmin(firebaseUser.uid);
          setIsAdmin(adminStatus);
        } catch (err) {
          console.error("[Auth] Error checking admin status:", err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Self-healing: Ensure a logged-in user has a profile, default role, and Meadow Life game
  async function ensureUserProfile(firebaseUser: User) {
    try {
      const profileRef = doc(db, "profiles", firebaseUser.uid);
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        const displayName = firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Player";
        
        // 1. Create Profile
        await setDoc(profileRef, {
          id: firebaseUser.uid,
          display_name: displayName,
          avatar_url: firebaseUser.photoURL || null,
          created_at: new Date().toISOString(),
        });
        console.log("[Auth] Created profile for new user:", firebaseUser.uid);

        // 2. Set Default Role
        const roleRef = doc(db, "user_roles", firebaseUser.uid);
        await setDoc(roleRef, {
          user_id: firebaseUser.uid,
          role: "user",
          created_at: new Date().toISOString(),
        });

        // 3. Grant Meadow Life game access
        const userGameRef = doc(db, "user_games", `${firebaseUser.uid}_meadow-life`);
        await setDoc(userGameRef, {
          id: `${firebaseUser.uid}_meadow-life`,
          user_id: firebaseUser.uid,
          game_id: "meadow-life",
          added_at: new Date().toISOString(),
          last_played_at: null,
        });
        console.log("[Auth] Provisioned default Meadow Life access");
      }
    } catch (err) {
      console.warn("[Auth] Profile self-healing checked/ignored:", err);
    }
  }

  const value: AuthContextValue = {
    user,
    session: user ? { user } : null,
    loading,
    isAdmin,
    signOut: async () => {
      await firebaseSignOut(auth);
      setIsAdmin(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}