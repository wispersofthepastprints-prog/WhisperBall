// Local persistence wrapper around our existing storage util.
// Keys are namespaced under "wb:" to avoid collisions.

import { storage } from "@/src/utils/storage";
import { ThemeId } from "@/src/game/theme";

const K = {
  campaignStars: "wb:campaign:stars", // record<id, 0..3>
  bestRally: "wb:bestRally",
  unlocked1972: "wb:unlocked:1972",
  themeId: "wb:theme",
  sound: "wb:sound",
  haptics: "wb:haptics",
  dailyBest: "wb:daily:best", // record<dateKey, score>
  quickBest: "wb:quick:best",
} as const;

export type Settings = {
  themeId: ThemeId;
  sound: boolean;
  haptics: boolean;
};

export async function getSettings(): Promise<Settings> {
  const themeId = (await storage.getItem<string>(K.themeId, "whisper")) as ThemeId;
  const sound = (await storage.getItem<boolean>(K.sound, true)) ?? true;
  const haptics = (await storage.getItem<boolean>(K.haptics, true)) ?? true;
  return { themeId: themeId || "whisper", sound: !!sound, haptics: !!haptics };
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const map: Record<keyof Settings, string> = {
    themeId: "wb:theme",
    sound: "wb:sound",
    haptics: "wb:haptics",
  };
  await storage.setItem(map[key], value as any);
}

export async function getCampaignStars(): Promise<Record<number, number>> {
  // storage util doesn't support objects natively (string|number|boolean|null),
  // so we JSON-encode into a string field.
  const raw = await storage.getItem<string>(K.campaignStars, "");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<number, number>;
  } catch {
    return {};
  }
}

export async function setCampaignStars(level: number, stars: number) {
  const current = await getCampaignStars();
  const prev = current[level] ?? 0;
  if (stars > prev) {
    current[level] = stars;
    await storage.setItem(K.campaignStars, JSON.stringify(current));
  }
}

export async function getBestRally(): Promise<number> {
  return (await storage.getItem<number>(K.bestRally, 0)) ?? 0;
}

export async function setBestRally(rally: number) {
  const prev = await getBestRally();
  if (rally > prev) {
    await storage.setItem(K.bestRally, rally);
  }
}

export async function getUnlocked1972(): Promise<boolean> {
  return (await storage.getItem<boolean>(K.unlocked1972, false)) ?? false;
}

export async function setUnlocked1972() {
  await storage.setItem(K.unlocked1972, true);
}

export async function getDailyBest(dateKey: string): Promise<number> {
  const raw = await storage.getItem<string>("wb:daily:best", "");
  if (!raw) return 0;
  try {
    const map = JSON.parse(raw) as Record<string, number>;
    return map[dateKey] ?? 0;
  } catch {
    return 0;
  }
}

export async function setDailyBest(dateKey: string, score: number) {
  const raw = await storage.getItem<string>("wb:daily:best", "");
  let map: Record<string, number> = {};
  if (raw) {
    try {
      map = JSON.parse(raw);
    } catch {
      map = {};
    }
  }
  if (score > (map[dateKey] ?? 0)) {
    map[dateKey] = score;
    await storage.setItem("wb:daily:best", JSON.stringify(map));
  }
}

export async function getQuickBest(): Promise<number> {
  return (await storage.getItem<number>(K.quickBest, 0)) ?? 0;
}

export async function setQuickBest(rally: number) {
  const prev = await getQuickBest();
  if (rally > prev) {
    await storage.setItem(K.quickBest, rally);
  }
}

// ---------- Match / streak tracking (for the landing-page stats row) ----------

const K_MATCHES = "wb:matches";
const K_STREAK = "wb:winStreak";

export async function getGamesPlayed(): Promise<number> {
  return (await storage.getItem<number>(K_MATCHES, 0)) ?? 0;
}

export async function incGamesPlayed() {
  const prev = await getGamesPlayed();
  await storage.setItem(K_MATCHES, prev + 1);
}

export async function getWinStreak(): Promise<number> {
  return (await storage.getItem<number>(K_STREAK, 0)) ?? 0;
}

export async function incWinStreak() {
  const prev = await getWinStreak();
  await storage.setItem(K_STREAK, prev + 1);
}

export async function resetWinStreak() {
  await storage.setItem(K_STREAK, 0);
}
