import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — CloudFarm Arcade" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAdmin } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile.data) { setDisplayName(profile.data.display_name ?? ""); setAvatarUrl(profile.data.avatar_url ?? ""); }
  }, [profile.data]);
  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: userId, display_name: displayName, avatar_url: avatarUrl || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-10">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          {isAdmin && <Badge className="gap-1"><Shield className="h-3 w-3" /> Admin</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">Update how you appear in CloudFarm Arcade.</p>
      </motion.header>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <Card className="border-border/60 shadow-[var(--shadow-soft)]">
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="space-y-2"><Label htmlFor="dn">Display name</Label><Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="av">Avatar URL</Label><Input id="av" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" /></div>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
