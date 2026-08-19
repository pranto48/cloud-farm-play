import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app/sidebar";
import { MobileNav } from "@/components/app/mobile-nav";
import { auth } from "@/integrations/firebase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await new Promise((resolve) => {
      const unsubscribe = onAuthStateChangedFallback(resolve);
    });
    if (!user) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function onAuthStateChangedFallback(resolve: (value: any) => void) {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    unsubscribe();
    resolve(user);
  });
  return unsubscribe;
}

function AppLayout() {
  const { loading, user } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  if (!user) return null;
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
