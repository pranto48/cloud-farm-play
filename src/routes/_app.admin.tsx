import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Users, Gamepad2, BarChart3, Database } from "lucide-react";
import { auth, db } from "@/integrations/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  head: () => ({ meta: [{ title: "Admin Panel — CloudFarm Arcade" }] }),
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
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
              Super Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage users, games, and platform settings on CloudFarm Arcade.
          </p>
        </div>
      </motion.header>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap gap-1 border-b border-border/60 pb-0"
      >
        {tabs.map((t) => {
          const active = t.exact ? path === t.to : path.startsWith(t.to) && !t.exact || path === t.to;
          // More precise active check
          const isActive = t.exact
            ? path === t.to || path === t.to + "/"
            : path.startsWith(t.to) && path !== "/admin";

          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Outlet />
      </motion.div>
    </div>
  );
}