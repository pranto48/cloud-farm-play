import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import {
  applyAuthPersistence,
  getSavedEmail,
  getTrustedDeviceInfo,
  saveTrustedDeviceInfo,
  clearTrustedDeviceInfo,
} from "@/lib/trustedDevice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Sprout, Trash2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — CloudFarm Arcade" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isTrusted, setIsTrusted] = useState(true);
  const [trustedInfo, setTrustedInfo] = useState(() => getTrustedDeviceInfo());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = getSavedEmail();
    if (saved) {
      setEmail(saved);
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await applyAuthPersistence(auth, isTrusted);
      await signInWithEmailAndPassword(auth, email, password);
      saveTrustedDeviceInfo(email, isTrusted);
      toast.success(isTrusted ? "Welcome back! Login session saved on this trusted device." : "Welcome back!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleForgetDevice() {
    clearTrustedDeviceInfo();
    setTrustedInfo(null);
    setEmail("");
    toast.info("Trusted device login cleared");
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to access your game library and cloud saves.">
      {trustedInfo && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold">Trusted Device Recognized</span>
              <p className="text-[10px] opacity-80">{trustedInfo.deviceName} • Saved Login Active</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleForgetDevice}
            className="h-7 px-2 text-xs text-emerald-300 hover:bg-emerald-900/40 hover:text-white"
            title="Forget this trusted device"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Forget
          </Button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot?
            </Link>
          </div>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="trust-device"
            checked={isTrusted}
            onChange={(e) => setIsTrusted(e.target.checked)}
            className="h-4 w-4 rounded border-stone-700 bg-stone-900 text-emerald-500 focus:ring-emerald-500 accent-emerald-500"
          />
          <Label htmlFor="trust-device" className="text-xs cursor-pointer select-none text-stone-300 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 inline" />
            Trust this device & keep logged in for 30 days
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <div className="absolute inset-0 [background:var(--gradient-hero)]" aria-hidden />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-primary-foreground">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <Sprout className="h-5 w-5" />
            </div>
            CloudFarm Arcade
          </Link>
          <blockquote className="max-w-md text-lg leading-relaxed">
            “A cozy place to keep all my browser games. The cloud saves are
            really the killer feature.”
            <footer className="mt-4 text-sm opacity-80">— Early player</footer>
          </blockquote>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}