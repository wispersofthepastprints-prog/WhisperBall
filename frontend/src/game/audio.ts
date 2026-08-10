// Audio manager for Whisper Ball.
// Uses expo-audio (the modern replacement for the deprecated expo-av).
// SFX are short one-shots replayed via seekTo(0); ambient is a looping bed
// started/stopped explicitly by the game screen.
// All calls are no-ops when sound is disabled or when a file isn't registered
// — so the manager never crashes the game.

import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

export type SfxKey =
  // Whisper theme
  | "score"
  | "wall_hit"
  | "paddle_hit"
  | "curve_hit"
  // 1972 theme
  | "retro_score"
  | "retro_wall_hit"
  | "retro_paddle_hit"
  // shared
  | "win"
  | "lose"
  | "menu_select"
  | "menu_back"
  | "rally_bonus"
  | "pause"
  | "serve";

export type LoopKey = "ambient_drone";

// IMPORTANT: paths are static `require` calls — Metro bundles each file at build time.
const SOURCES: Partial<Record<SfxKey, number>> = {
  score: require("../../assets/audio/score.wav"),
  wall_hit: require("../../assets/audio/wall_hit.wav"),
  paddle_hit: require("../../assets/audio/paddle_hit.wav"),
  retro_score: require("../../assets/audio/retro_score.wav"),
  retro_wall_hit: require("../../assets/audio/retro_wall_hit.wav"),
  retro_paddle_hit: require("../../assets/audio/retro_paddle_hit.wav"),
  win: require("../../assets/audio/win.wav"),
  lose: require("../../assets/audio/lose.wav"),
  menu_select: require("../../assets/audio/menu_select.wav"),
  menu_back: require("../../assets/audio/menu_back.wav"),
  rally_bonus: require("../../assets/audio/rally_bonus.wav"),
};

const LOOP_SOURCES: Record<LoopKey, number> = {
  ambient_drone: require("../../assets/audio/ambient_drone.wav"),
};

const players: Partial<Record<SfxKey, AudioPlayer>> = {};
const loopPlayers: Partial<Record<LoopKey, AudioPlayer>> = {};
let enabled = true;
let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    });
  } catch {
    // ignore — sfx still plays without explicit session config
  }
}

function ensurePlayer(key: SfxKey): AudioPlayer | null {
  if (players[key]) return players[key]!;
  const src = SOURCES[key];
  if (src == null) return null;
  try {
    const p = createAudioPlayer(src, { updateInterval: 1000 });
    players[key] = p;
    return p;
  } catch {
    return null;
  }
}

function ensureLoopPlayer(key: LoopKey): AudioPlayer | null {
  if (loopPlayers[key]) return loopPlayers[key]!;
  const src = LOOP_SOURCES[key];
  if (src == null) return null;
  try {
    const p = createAudioPlayer(src, { updateInterval: 1000 });
    p.loop = true;
    loopPlayers[key] = p;
    return p;
  } catch {
    return null;
  }
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
  // If disabled mid-session, also pause any active ambient loops.
  if (!v) {
    for (const k of Object.keys(loopPlayers) as LoopKey[]) {
      try {
        loopPlayers[k]?.pause();
      } catch {
        // ignore
      }
    }
  }
}

export async function preloadSfx() {
  // Best-effort init + warm up a couple of players so the first hit isn't laggy.
  await init();
  ensurePlayer("paddle_hit");
  ensurePlayer("wall_hit");
  ensurePlayer("score");
  ensureLoopPlayer("ambient_drone");
}

export function playSfx(key: SfxKey, volume = 1) {
  if (!enabled) return;
  const p = ensurePlayer(key);
  if (!p) return;
  try {
    p.seekTo(0);
    p.volume = Math.max(0, Math.min(1, volume));
    p.play();
  } catch {
    // swallow — sfx must never crash the game
  }
}

export function startLoop(key: LoopKey, volume = 0.4) {
  if (!enabled) return;
  // init() is fire-and-forget so the first call doesn't await; the loop will
  // simply skip the audio-mode config if it isn't done yet — fine on web.
  init();
  const p = ensureLoopPlayer(key);
  if (!p) return;
  try {
    p.volume = Math.max(0, Math.min(1, volume));
    p.loop = true;
    // Restart from beginning so two consecutive starts don't accumulate offsets.
    p.seekTo(0);
    p.play();
  } catch {
    // ignore
  }
}

export function stopLoop(key: LoopKey) {
  const p = loopPlayers[key];
  if (!p) return;
  try {
    p.pause();
    p.seekTo(0);
  } catch {
    // ignore
  }
}

export function unloadAllSfx() {
  for (const key of Object.keys(players) as SfxKey[]) {
    try {
      players[key]?.remove();
    } catch {
      // ignore
    }
    delete players[key];
  }
  for (const key of Object.keys(loopPlayers) as LoopKey[]) {
    try {
      loopPlayers[key]?.remove();
    } catch {
      // ignore
    }
    delete loopPlayers[key];
  }
}

export function hasSfx(key: SfxKey): boolean {
  return SOURCES[key] != null;
}
