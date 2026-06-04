import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./login";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — CloudFarm Arcade" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const actionCodeSettings = {
        url: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "",
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSent(true);
      toast.success("Check your inbox for a reset link.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new one.">
      {sent ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>If an account exists for {email}, a reset link is on its way.</p>
          <Button asChild variant="outline" className="w-full"><Link to="/login">Back to login</Link></Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
          <p className="text-center text-sm text-muted-foreground"><Link to="/login" className="hover:text-foreground">Back to login</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
