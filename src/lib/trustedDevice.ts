import { setPersistence, browserLocalPersistence, browserSessionPersistence, type Auth } from "firebase/auth";

export interface TrustedDeviceInfo {
  deviceId: string;
  email: string;
  trustedAt: string;
  expiresAt: number; // 30 days expiry timestamp
  deviceName: string;
  autoSaveEnabled: boolean;
  savedDays: number;
}

const TRUSTED_DEVICE_KEY = "cloudfarm_trusted_device";
const SAVED_EMAIL_KEY = "cloudfarm_saved_email";
const SESSION_COOKIE_KEY = "cloudfarm_session_30d";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server-device";
  let id = localStorage.getItem("cloudfarm_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    localStorage.setItem("cloudfarm_device_id", id);
  }
  return id;
}

export function getDeviceName(): string {
  if (typeof window === "undefined") return "Web Client";
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "Desktop";
  if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

export function getTrustedDeviceInfo(): TrustedDeviceInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICE_KEY);
    if (!raw) return null;
    const info = JSON.parse(raw) as TrustedDeviceInfo;

    // Verify 30-day expiration
    if (info.expiresAt && Date.now() > info.expiresAt) {
      clearTrustedDeviceInfo();
      return null;
    }

    return info;
  } catch {
    return null;
  }
}

export function saveTrustedDeviceInfo(email: string, isTrusted: boolean): void {
  if (typeof window === "undefined") return;
  if (isTrusted) {
    const now = Date.now();
    const expiresAt = now + THIRTY_DAYS_MS;
    const info: TrustedDeviceInfo = {
      deviceId: getDeviceId(),
      email,
      trustedAt: new Date(now).toISOString(),
      expiresAt,
      deviceName: getDeviceName(),
      autoSaveEnabled: true,
      savedDays: 30,
    };
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(info));
    localStorage.setItem(SAVED_EMAIL_KEY, email);

    // Set 30-day persistent cookie
    try {
      document.cookie = `${SESSION_COOKIE_KEY}=${encodeURIComponent(email)}; max-age=${THIRTY_DAYS_SEC}; path=/; SameSite=Lax`;
    } catch (e) {
      console.warn("[TrustedDevice] Failed to write cookie:", e);
    }
  } else {
    clearTrustedDeviceInfo();
  }
}

export function clearTrustedDeviceInfo(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TRUSTED_DEVICE_KEY);
  localStorage.removeItem(SAVED_EMAIL_KEY);
  try {
    document.cookie = `${SESSION_COOKIE_KEY}=; max-age=0; path=/; SameSite=Lax`;
  } catch {}
}

export function getSavedEmail(): string {
  if (typeof window === "undefined") return "";
  const info = getTrustedDeviceInfo();
  return info?.email || localStorage.getItem(SAVED_EMAIL_KEY) || "";
}

export async function applyAuthPersistence(auth: Auth, isTrusted: boolean = true): Promise<void> {
  try {
    await setPersistence(auth, isTrusted ? browserLocalPersistence : browserSessionPersistence);
  } catch (err) {
    console.warn("[TrustedDevice] Failed to set auth persistence:", err);
  }
}
