import { setPersistence, browserLocalPersistence, browserSessionPersistence, type Auth } from "firebase/auth";

export interface TrustedDeviceInfo {
  deviceId: string;
  email: string;
  trustedAt: string;
  deviceName: string;
  autoSaveEnabled: boolean;
}

const TRUSTED_DEVICE_KEY = "cloudfarm_trusted_device";
const SAVED_EMAIL_KEY = "cloudfarm_saved_email";

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
    return JSON.parse(raw) as TrustedDeviceInfo;
  } catch {
    return null;
  }
}

export function saveTrustedDeviceInfo(email: string, isTrusted: boolean): void {
  if (typeof window === "undefined") return;
  if (isTrusted) {
    const info: TrustedDeviceInfo = {
      deviceId: getDeviceId(),
      email,
      trustedAt: new Date().toISOString(),
      deviceName: getDeviceName(),
      autoSaveEnabled: true,
    };
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(info));
    localStorage.setItem(SAVED_EMAIL_KEY, email);
  } else {
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
  }
}

export function clearTrustedDeviceInfo(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TRUSTED_DEVICE_KEY);
  localStorage.removeItem(SAVED_EMAIL_KEY);
}

export function getSavedEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SAVED_EMAIL_KEY) || getTrustedDeviceInfo()?.email || "";
}

export async function applyAuthPersistence(auth: Auth, isTrusted: boolean): Promise<void> {
  try {
    await setPersistence(auth, isTrusted ? browserLocalPersistence : browserSessionPersistence);
  } catch (err) {
    console.warn("[TrustedDevice] Failed to set auth persistence:", err);
  }
}
