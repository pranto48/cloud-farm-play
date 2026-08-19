import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/integrations/firebase/auth-middleware";
import { adminAuth, adminDb, isMockAdmin } from "@/integrations/firebase/client.server";

async function assertAdmin(userId: string) {
  if (isMockAdmin) {
    // In mock mode, we bypass check for local testing
    return;
  }
  const roleRef = adminDb!.collection("user_roles").doc(userId);
  const snap = await roleRef.get();
  if (!snap.exists || snap.data()?.role !== "admin") {
    throw new Error("Forbidden: admin only");
  }
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d: { email: string; password: string; displayName?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    
    if (isMockAdmin) {
      console.warn("[Admin Server Function] Mock createUser called:", data.email);
      return { id: `mock-user-${Date.now()}` };
    }
    
    try {
      const created = await adminAuth!.createUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName ?? data.email.split("@")[0],
        emailVerified: true,
      });
      return { id: created.uid };
    } catch (err: any) {
      throw new Error(err.message);
    }
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    await assertAdmin(context.userId);
    
    if (isMockAdmin) {
      console.warn("[Admin Server Function] Mock deleteUser called:", data.userId);
      return { ok: true };
    }
    
    try {
      await adminAuth!.deleteUser(data.userId);
      return { ok: true };
    } catch (err: any) {
      throw new Error(err.message);
    }
  });