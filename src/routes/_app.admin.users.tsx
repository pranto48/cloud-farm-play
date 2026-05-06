import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { adminFetchAllUsers, adminFetchUserRoles, adminToggleAdmin } from "@/lib/queries";
import { adminCreateUser, adminDeleteUser } from "@/server/admin.functions.server";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: adminFetchAllUsers });
  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: adminFetchUserRoles });
  const toggle = useMutation({
    mutationFn: ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => adminToggleAdmin(userId, makeAdmin),
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-roles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const create = useMutation({
    mutationFn: () => adminCreateUser({ data: { email, password } }),
    onSuccess: () => { toast.success("User created"); setEmail(""); setPassword(""); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (userId: string) => adminDeleteUser({ data: { userId } }),
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const adminIds = new Set((roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
  return (
    <div className="space-y-3">
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
          <Input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="password (min 6)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button disabled={create.isPending || !email || password.length < 6} onClick={() => create.mutate()}>Create user</Button>
        </CardContent>
      </Card>
      {(users.data ?? []).map((u, i) => {
        const isAdmin = adminIds.has(u.id);
        const isSelf = u.id === user?.id;
        return (
          <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="border-border/60">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{u.display_name ?? "Unnamed"}</h3>
                    {isAdmin && <Badge>Admin</Badge>}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{u.id}</p>
                  <p className="text-xs text-muted-foreground">Joined {format(new Date(u.created_at), "PP")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant={isAdmin ? "outline" : "default"} size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate({ userId: u.id, makeAdmin: !isAdmin })}>
                    {isAdmin ? "Remove admin" : "Make admin"}
                  </Button>
                  {!isSelf && (
                    <Button variant="destructive" size="sm" disabled={del.isPending} onClick={() => { if (confirm("Delete this user?")) del.mutate(u.id); }}>
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
      {users.data?.length === 0 && <p className="text-sm text-muted-foreground">No users.</p>}
    </div>
  );
}