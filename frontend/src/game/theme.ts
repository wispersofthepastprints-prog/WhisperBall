// Themes for Whisper Ball
// Default "Whisper": ivory paddles, obsidian background, gold ball accent.
// "1972": retro phosphor green Pong (unlocked at 50-hit rally).

export type ThemeId = "whisper" | "1972";

export type Theme = {
  id: ThemeId;
  name: string;
  bg: string;
  bgGradientTop: string;
  bgGradientBottom: string;
  paddle: string;
  paddleShadow: string;
  ball: string;
  ballGlow: string;
  centerLine: string;
  text: string;
  textMuted: string;
  accent: string;
  trail: string;
  scanlines: boolean;
};

export const THEMES: Record<ThemeId, Theme> = {
  whisper: {
    id: "whisper",
    name: "Whisper",
    bg: "#0A0A0F",
    bgGradientTop: "#12121A",
    bgGradientBottom: "#06060A",
    paddle: "#F4EBD7",
    paddleShadow: "rgba(244, 235, 215, 0.35)",
    ball: "#E9C26B",
    ballGlow: "rgba(233, 194, 107, 0.55)",
    centerLine: "rgba(244, 235, 215, 0.12)",
    text: "#F4EBD7",
    textMuted: "rgba(244, 235, 215, 0.55)",
    accent: "#E9C26B",
    trail: "rgba(233, 194, 107, 0.18)",
    scanlines: false,
  },
  "1972": {
    id: "1972",
    name: "1972",
    bg: "#000000",
    bgGradientTop: "#020602",
    bgGradientBottom: "#000000",
    paddle: "#7CFC8A",
    paddleShadow: "rgba(124, 252, 138, 0.5)",
    ball: "#7CFC8A",
    ballGlow: "rgba(124, 252, 138, 0.6)",
    centerLine: "rgba(124, 252, 138, 0.25)",
    text: "#7CFC8A",
    textMuted: "rgba(124, 252, 138, 0.55)",
    accent: "#7CFC8A",
    trail: "rgba(124, 252, 138, 0.22)",
    scanlines: true,
  },
};
