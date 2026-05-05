import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, Cloud, User, LogOut, Sprout, Moon, Sun, Gamepad2, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "My Games", icon: Library },
  { to: "/games", label: "Game List", icon: Gamepad2 },
  { to: "/saves", label: "Cloud Saves", icon: Cloud },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-soft)]">
            <Sprout className="h-5 w-5" />
          </div>
          CloudFarm
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item, i) => {
          const active = path === item.to || path.startsWith(item.to + "/");
          return (
            <motion.div key={item.to} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <Link
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:translate-x-0.5",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-soft)]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </motion.div>
          );
        })}
        {isAdmin && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Link
              to="/admin"
              className={cn(
                "mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:translate-x-0.5",
                path.startsWith("/admin")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-soft)]"
                  : "border border-dashed border-sidebar-border text-sidebar-foreground/80 hover:bg-sidebar-accent",
              )}
            >
              <Shield className="h-4 w-4" /> Admin Panel
            </Link>
          </motion.div>
        )}
      </nav>
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="truncate px-2 text-xs text-muted-foreground">{user?.email}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={toggle} aria-label="Toggle theme" className="shrink-0">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={async () => {
              await signOut();
              toast.success("Signed out");
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}