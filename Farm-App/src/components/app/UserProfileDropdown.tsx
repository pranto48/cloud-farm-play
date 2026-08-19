import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  User as UserIcon,
  LayoutDashboard,
  Library,
  Cloud,
  Shield,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Gamepad2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTrustedDeviceInfo } from "@/lib/trustedDevice";
import { toast } from "sonner";

export function UserProfileDropdown() {
  const { user, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const trustedInfo = getTrustedDeviceInfo();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Login</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/signup">Sign Up</Link>
        </Button>
      </div>
    );
  }

  const initials = user.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user.email
    ? user.email.slice(0, 2).toUpperCase()
    : "CF";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative flex items-center gap-2 rounded-full p-1 pl-1.5 pr-2.5 hover:bg-muted focus-visible:ring-1"
        >
          <Avatar className="h-8 w-8 border border-primary/30 shadow-sm">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
            <AvatarFallback className="bg-[image:var(--gradient-hero)] text-xs font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <div className="text-xs font-semibold leading-none">{user.displayName || user.email?.split("@")[0]}</div>
            <div className="text-[10px] text-muted-foreground">{isAdmin ? "Admin" : "Player"}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64 p-2 shadow-xl border-border bg-card" align="end" forceMount>
        {/* User Card Header */}
        <DropdownMenuLabel className="font-normal p-2 bg-muted/50 rounded-md mb-1 border border-border/50">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9 border border-primary/40">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="bg-[image:var(--gradient-hero)] font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="truncate">
                <p className="text-sm font-semibold leading-none">{user.displayName || "Cloud Player"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
              {trustedInfo && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-2.5 w-2.5" /> Trusted Device
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  <Sparkles className="h-2.5 w-2.5" /> Admin
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Navigation Items */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/dashboard" className="flex items-center">
              <LayoutDashboard className="mr-2.5 h-4 w-4 text-primary" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/library" className="flex items-center">
              <Library className="mr-2.5 h-4 w-4 text-emerald-500" />
              <span>My Games</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/games" className="flex items-center">
              <Gamepad2 className="mr-2.5 h-4 w-4 text-amber-500" />
              <span>Game List</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/saves" className="flex items-center">
              <Cloud className="mr-2.5 h-4 w-4 text-cyan-500" />
              <span>Cloud Saves</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/profile" className="flex items-center">
              <UserIcon className="mr-2.5 h-4 w-4 text-indigo-500" />
              <span>Profile Settings</span>
            </Link>
          </DropdownMenuItem>

          {isAdmin && (
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/admin" className="flex items-center font-semibold text-purple-400">
                <Shield className="mr-2.5 h-4 w-4 text-purple-400" />
                <span>Admin Panel</span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Theme Toggle & Sign Out */}
        <DropdownMenuItem onClick={toggle} className="cursor-pointer">
          {theme === "dark" ? <Sun className="mr-2.5 h-4 w-4 text-yellow-400" /> : <Moon className="mr-2.5 h-4 w-4 text-slate-700" />}
          <span>{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={async () => {
            await signOut();
            toast.success("Signed out successfully");
            navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-2.5 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
