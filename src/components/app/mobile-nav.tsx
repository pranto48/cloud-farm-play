import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard, Library, Cloud, User, Gamepad2, Shield, LogOut, Sprout, Moon, Sun } from "lucide-react";
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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground"><Sprout className="h-4 w-4" /></div>
          CloudFarm
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggle}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="sticky top-[57px] z-20 border-b border-border bg-background md:hidden">
            <nav className="space-y-1 p-3">
              {items.map((it) => {
                const active = path === it.to || path.startsWith(it.to + "/");
                return (
                  <Link key={it.to} to={it.to} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm", active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    <it.icon className="h-4 w-4" /> {it.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link to="/admin" onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm", path.startsWith("/admin") ? "bg-primary text-primary-foreground" : "border border-dashed hover:bg-muted")}>
                  <Shield className="h-4 w-4" /> Admin Panel
                </Link>
              )}
              <Button variant="outline" className="mt-2 w-full" onClick={async () => { await signOut(); toast.success("Signed out"); navigate({ to: "/" }); }}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}