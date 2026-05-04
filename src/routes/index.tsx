import { createFileRoute, Link } from "@tanstack/react-router";
import { Cloud, Library, Gamepad2, Sprout, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CloudFarm Arcade — Play your web games anywhere" },
      {
        name: "description",
        content:
          "Sign up, build a personal game library, and play cozy browser games with cloud saves on any device.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Cloud, title: "Cloud saves", body: "Your progress follows you to any device, automatically." },
  { icon: Library, title: "Personal library", body: "All your web games in one tidy, searchable place." },
  { icon: Gamepad2, title: "Browser-based play", body: "No installs, no downloads. Just open and play." },
  { icon: Sprout, title: "Cozy demo included", body: "Start with Meadow Life, an original cozy farming demo." },
];

function Landing() {
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-soft)]">
            <Sprout className="h-5 w-5" />
          </div>
          <span>CloudFarm Arcade</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {!loading && user ? (
            <Button asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-60 [background:var(--gradient-hero)]" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-background/70 backdrop-blur-3xl" aria-hidden />
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
            ✦ Cozy games, cloud saves, zero setup
          </span>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight md:text-6xl">
            Play your web games <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">anywhere</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            CloudFarm Arcade keeps your library and saves in the cloud, so you can pick up your harvest from any browser.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/signup"}>Get Started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={user ? "/library" : "/login"}>{user ? "My library" : "Login"}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="border-border/60 shadow-[var(--shadow-soft)]">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CloudFarm Arcade
      </footer>
    </div>
  );
}
