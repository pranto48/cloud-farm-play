import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { confirmPasswordReset, updatePassword } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./login";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — CloudFarm Arcade" }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const oobCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("oobCode") : null;
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, password);
        toast.success("Password reset successfully. You can now log in.");
        navigate({ to: "/login" });
      } else if (auth.currentUser) {
        await updatePassword(auth.currentUser, password);
        toast.success("Password updated successfully.");
        navigate({ to: "/dashboard" });
      } else {
        toast.error("Invalid request: No active session or reset code found.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Set a new password" subtitle="Pick something at least 8 characters long.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
      </form>
    </AuthShell>
  );
}
