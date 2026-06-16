import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { adminFetchAllUsers, adminFetchUserRoles, adminToggleAdmin } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search, Shield, ShieldOff, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/users")({
  component: AdminUsers,
});

const SUPER_ADMIN_EMAIL = "mail@arifmahmud.com";

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-orange-500", "bg-pink-500", "bg-teal-500",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", color)}>
      {initials || "?"}
    </div>
  );
}

function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const users = useQuery({ queryKey: ["admin-users"], queryFn: adminFetchAllUsers });
  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: adminFetchUserRoles });

  const toggle = useMutation({
    mutationFn: ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) =>
      adminToggleAdmin(userId, makeAdmin),
    onSuccess: (_, vars) => {
      toast.success(vars.makeAdmin ? "Admin role granted ✓" : "Admin role removed");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminIds = new Set(
    (roles.data ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id)
  );

  const filtered = (users.data ?? []).filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.display_name ?? "").toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const adminCount = adminIds.size;
  const totalUsers = users.data?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm shadow-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{totalUsers}</span>
          <span className="text-muted-foreground">total users</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm shadow-sm">
          <Crown className="h-4 w-4 text-amber-500" />
          <span className="font-semibold">{adminCount}</span>
          <span className="text-muted-foreground">admins</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or UID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* User List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No users match your search." : "No users yet."}
          </p>
        )}
        {filtered.map((u: any, i: number) => {
          const isAdmin = adminIds.has(u.id);
          const isSuperAdmin = false; // We don't expose email from profiles, just visual indicator
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className={cn("border-border/60 transition-colors", isAdmin && "border-amber-500/30 bg-amber-500/5")}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <UserAvatar name={u.display_name ?? "?"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{u.display_name ?? "Unnamed"}</h3>
                      {isAdmin && (
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          <Crown className="mr-1 h-3 w-3" /> Admin
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-0.5">
                      <p className="font-mono text-xs text-muted-foreground">{u.id}</p>
                      {u.created_at && (
                        <p className="text-xs text-muted-foreground">
                          Joined {format(new Date(u.created_at), "PP")}
                          {" · "}
                          {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant={isAdmin ? "outline" : "default"}
                      size="sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ userId: u.id, makeAdmin: !isAdmin })}
                      className={cn(isAdmin && "border-red-500/40 text-red-600 hover:bg-red-500/10")}
                    >
                      {isAdmin ? (
                        <>
                          <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Remove admin
                        </>
                      ) : (
                        <>
                          <Shield className="mr-1.5 h-3.5 w-3.5" /> Make admin
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
