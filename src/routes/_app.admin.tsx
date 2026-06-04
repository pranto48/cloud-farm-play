import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Users, Gamepad2, BarChart3 } from "lucide-react";
import { auth, db } from "@/integrations/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async () => {
    const user = await new Promise<any>((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((u) => {
        unsubscribe();
        resolve(u);
      });
    });
    if (!user) throw redirect({ to: "/login" });

    const roleSnap = await getDoc(doc(db, "user_roles", user.uid));
    if (!roleSnap.exists() || roleSnap.data().role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Admin — CloudFarm Arcade" }] }),
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { to: "/admin/users", label: "Users", icon: Users, exact: false },
  { to: "/admin/games", label: "Games", icon: Gamepad2, exact: false },
] as const;

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-10">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-soft)]"><Shield className="h-5 w-5" /></div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage users and games on CloudFarm Arcade.</p>
        </div>
      </motion.header>
      <div className="flex flex-wrap gap-2 border-b border-border/60">
        {tabs.map((t) => {
          const active = t.exact ? path === t.to : path.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to} className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}