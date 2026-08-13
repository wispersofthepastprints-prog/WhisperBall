import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelConfig, levelById } from "@/src/game/levels";
import {
  getSettings,
  setBestRally,
  setCampaignStars,
  setDailyBest,
  setQuickBest,
  setUnlocked1972,
  incGamesPlayed,
  incWinStreak,
  resetWinStreak,
} from "@/src/game/persistence";
import { mulberry32, seedFromKey, todayKey } from "@/src/game/seed";
import { THEMES, Theme, ThemeId } from "@/src/game/theme";
import { playSfx, preloadSfx, setSoundEnabled, startLoop, stopLoop } from "@/src/game/audio";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { loadInterstitial, showInterstitial, loadRewarded, showRewarded } from "@/src/game/ads";
import { checkRemoveAdsStatus, checkPremiumStatus } from "@/src/game/purchases";

type Mode = "quick" | "campaign" | "daily" | "local2p";
type Phase = "ready" | "playing" | "scored" | "ended";

// ===== Physical constants (px/s, px) =====
// In portrait the paddle's LONG dimension runs horizontally; its thin edge
// runs vertically. Ball travel is primarily vertical.
const BASE_SPEED = 480;
const PADDLE_BASE_W = 110;   // paddle's long (horizontal) dimension at level 1
const PADDLE_THICK = 12;     // paddle's thin (vertical) dimension
const PADDLE_INSET = 26;     // distance from top/bottom court edge to paddle
const BALL_R = 9;
const OBSTACLE_LEN = 70;     // obstacle bar long dimension (horizontal)
const OBSTACLE_THICK = 14;   // obstacle bar thin dimension (vertical)

// AdMob banner configuration
const BANNER_AD_UNIT_ID = __DEV__ 
  ? TestIds.BANNER 
  : 'ca-app-pub-1508365322358813/3187025405'; // Replace with your real banner ad unit ID
const BANNER_HEIGHT = 50;

// Phase enum as numbers for the worklet (can't read TS string types in worklet cleanly)
const PH_READY = 0;
const PH_PLAYING = 1;
const PH_SCORED = 2;
const PH_ENDED = 3;

export default function Game() {
  const params = useLocalSearchParams<{ mode?: Mode; level?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mode = (params.mode as Mode) ?? "quick";
  const levelId = parseInt(params.level ?? "1", 10) || 1;

  const [themeId, setThemeId] = useState<ThemeId>("whisper");
  const [hapticsOn, setHapticsOn] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await getSettings();
        if (!mounted) return;
        setThemeId(s.themeId);
        setHapticsOn(s.haptics);
        setSoundEnabled(s.sound);
        preloadSfx();
        if (s.sound) startLoop("ambient_drone", 0.35);

        // Preload ads and check purchase status
        loadInterstitial();
        loadRewarded();
        const removed = await checkRemoveAdsStatus();
        const premium = await checkPremiumStatus();
        if (mounted) {
          setAdsRemoved(removed);
          setPremiumActive(premium);
        }
      } catch {
        // defaults are fine
      }
    })();
    return () => {
      mounted = false;
      stopLoop("ambient_drone");
    };
  }, []);

  return (
    <GameInner
      mode={mode}
      levelId={levelId}
      theme={THEMES[themeId] ?? THEMES.whisper}
      hapticsOn={hapticsOn}
      insets={{ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }}
      onExit={() => router.replace("/")}
      onCampaignBack={() => router.replace("/campaign")}
    />
  );
}

function canShowInterstitial(lastTime: number): boolean {
  return Date.now() - lastTime >= 90000; // 90 second minimum gap
}

function GameInner({
  mode,
  levelId,
  theme,
  hapticsOn,
  insets,
  onExit,
  onCampaignBack,
}: {
  mode: Mode;
  levelId: number;
  theme: Theme;
  hapticsOn: boolean;
  insets: { top: number; bottom: number; left: number; right: number };
  onExit: () => void;
  onCampaignBack: () => void;
}) {
  // ===== Resolve mode parameters =====
  const level: LevelConfig = useMemo(() => {
    if (mode === "campaign") return levelById(levelId);
    if (mode === "quick")
      return {
        id: 0,
        name: "Quick",
        ballSpeed: 1.0,
        paddleSize: 1.0,
        cpuSkill: 0.6,
        speedUp: 1.04,
        target: 7,
        stars: [0, 0, 0],
        spin: 0.4,
        obstacleCount: 0,
        obstacleMoving: false,
      };
    if (mode === "local2p")
      return {
        id: 0,
        name: "Local 2P",
        ballSpeed: 1.0,
        paddleSize: 1.05,
        cpuSkill: 0,
        speedUp: 1.04,
        target: 7,
        stars: [0, 0, 0],
        spin: 0.45,
        obstacleCount: 0,
        obstacleMoving: false,
      };
    // daily — deterministic per UTC date
    const seed = seedFromKey(todayKey());
    const rng = mulberry32(seed);
    const obsRoll = rng();
    return {
      id: 0,
      name: `Daily ${todayKey()}`,
      ballSpeed: 0.95 + rng() * 0.6,
      paddleSize: 0.7 + rng() * 0.4,
      cpuSkill: 0.6 + rng() * 0.3,
      speedUp: 1.035 + rng() * 0.02,
      target: 9,
      stars: [0, 0, 0],
      spin: 0.4,
      obstacleCount: obsRoll < 0.33 ? 0 : obsRoll < 0.7 ? 1 : 2,
      obstacleMoving: rng() > 0.6,
    };
  }, [mode, levelId]);

  // ===== Court size (via onLayout) =====
  const [court, setCourt] = useState({ w: 0, h: 0 });
  const courtW = useSharedValue(0);
  const courtH = useSharedValue(0);

  // ===== Shared values (UI-thread physics) =====
  // Ball position + velocity (screen coords: +x right, +y down).
  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  const bvx = useSharedValue(0);
  const bvy = useSharedValue(0);
  // Multi-ball secondary
  const b2Active = useSharedValue(0);
  const b2x = useSharedValue(0);
  const b2y = useSharedValue(0);
  const b2vx = useSharedValue(0);
  const b2vy = useSharedValue(0);

  // Paddles — p1 = BOTTOM (player), p2 = TOP (CPU or P2). Horizontal positions.
  const p1x = useSharedValue(0);
  const p2x = useSharedValue(0);
  const p1tx = useSharedValue(0);
  const p2tx = useSharedValue(0);
  // Paddle long-axis dimension (horizontal width). Scales with level.
  const paddleW = useSharedValue(PADDLE_BASE_W * level.paddleSize);

  const phase = useSharedValue<number>(PH_READY);
  const rallyShared = useSharedValue(0);
  const obstacleCount = useSharedValue(level.obstacleCount);
  const obstacleMoving = useSharedValue(level.obstacleMoving ? 1 : 0);
  const obstaclePhase = useSharedValue(0);

  // Paddle velocity (horizontal, for curve)
  const p1Vel = useSharedValue(0);
  const p2Vel = useSharedValue(0);
  const p1PrevX = useSharedValue(0);
  const p2PrevX = useSharedValue(0);

  // Curve = perpendicular acceleration applied to ball velocity, decays over time
  const ballCurve = useSharedValue(0);
  const ball2Curve = useSharedValue(0);
  const curveFx = useSharedValue(0);

  // Gradual speed ramp — eases from SERVE_FACTOR_START up to 1.0
  const SERVE_FACTOR_START = 0.55;
  const SERVE_RAMP_SECONDS = 3.5;
  const ballSpeedFactor = useSharedValue(SERVE_FACTOR_START);

  // ===== JS state =====
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [rally, setRally] = useState(0);
  const [phaseJS, setPhaseJS] = useState<Phase>("ready");
  const [paused, setPaused] = useState(false);
  const [winner, setWinner] = useState<"p1" | "p2" | null>(null);
  const [hudFlash, setHudFlash] = useState(0);
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [premiumActive, setPremiumActive] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const lastInterstitialTime = useRef<number>(0);

  // Adaptive CPU
  const cpuSkillRef = useRef<number>(level.cpuSkill);
  const cpuSkillShared = useSharedValue(level.cpuSkill);

  const rallyBestRef = useRef(0);

  // Daily Challenge deterministic RNG — same seed for every player on a given UTC date.
  const dailyRngRef = useRef<(() => number) | null>(null);
  useEffect(() => {
    if (mode === "daily" && dailyRngRef.current === null) {
      dailyRngRef.current = mulberry32(seedFromKey(todayKey()) ^ 0xa5a5);
    }
  }, [mode]);
  const nextRand = () =>
    mode === "daily" && dailyRngRef.current ? dailyRngRef.current() : Math.random();

  // ===== Layout handler =====
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCourt({ w: width, h: height });
    courtW.value = width;
    courtH.value = height;
    p1x.value = width / 2;
    p2x.value = width / 2;
    p1tx.value = width / 2;
    p2tx.value = width / 2;
    p1PrevX.value = width / 2;
    p2PrevX.value = width / 2;
    // First serve direction: +1 = DOWN (toward player), -1 = UP (toward CPU).
    serve(width, height, Math.random() > 0.5 ? 1 : -1);
  };

  // ===== Serve / reset ball =====
  const serve = (w: number, h: number, dir: 1 | -1) => {
    const speed = BASE_SPEED * level.ballSpeed;
    // Angle is the deviation from pure vertical. cos -> vertical component, sin -> horizontal wiggle.
    const angle = (nextRand() - 0.5) * 0.6;
    bx.value = w / 2;
    by.value = h / 2;
    ballSpeedFactor.value = SERVE_FACTOR_START;
    bvx.value = Math.sin(angle) * speed * SERVE_FACTOR_START;
    bvy.value = Math.cos(angle) * speed * dir * SERVE_FACTOR_START;
    ballCurve.value = 0;
    ball2Curve.value = 0;
    curveFx.value = 0;
    if (level.multiBall) {
      b2Active.value = 1;
      b2x.value = w / 2;
      b2y.value = h / 2;
      const a2 = angle + Math.PI / 4;
      b2vx.value = Math.sin(a2) * speed * SERVE_FACTOR_START;
      b2vy.value = Math.cos(a2) * speed * -dir * SERVE_FACTOR_START;
    } else {
      b2Active.value = 0;
    }
    rallyShared.value = 0;
    setRally(0);
    phase.value = PH_PLAYING;
    setPhaseJS("playing");
  };

  // ===== JS-thread callbacks invoked from the worklet =====
  const hapticLight = () => {
    if (hapticsOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const hapticMedium = () => {
    if (hapticsOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  const hapticHeavy = () => {
    if (hapticsOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  const onPaddleHit = () => {
    hapticLight();
    playSfx(theme.id === "1972" ? "retro_paddle_hit" : "paddle_hit", 0.85);
    setRally((r) => {
      const nr = r + 1;
      if (nr > rallyBestRef.current) rallyBestRef.current = nr;
      if (nr === 5 || nr === 10 || nr === 25 || nr === 50) {
        playSfx("rally_bonus", 0.9);
      }
      if (nr >= 50) setUnlocked1972().catch(() => {});
      return nr;
    });
  };

  const onCurveHit = () => {
    if (hapticsOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const onWallHit = () => {
    if (hapticsOn) Haptics.selectionAsync().catch(() => {});
    playSfx(theme.id === "1972" ? "retro_wall_hit" : "wall_hit", 0.7);
  };

  const onScored = (who: "p1" | "p2") => {
    hapticMedium();
    playSfx(theme.id === "1972" ? "retro_score" : "score", 0.9);
    setScore((s) => {
      const next = { ...s, [who]: s[who] + 1 };
      if (next[who] >= level.target) {
        setWinner(who);
        setPhaseJS("ended");
        phase.value = PH_ENDED;
        // Enable "continue with ad" if player lost by exactly 1 point
        const margin = Math.abs(next.p1 - next.p2);
        setCanContinue(who === "p2" && margin === 1 && mode !== "local2p");
        finishRound(next, who);
      } else {
        setPhaseJS("scored");
        phase.value = PH_SCORED;
        setHudFlash(1);
        setTimeout(() => {
          if (court.w && court.h) {
            // After p1 (bottom) scores, ball serves UP (-1) toward CPU.
            // After p2 (top) scores, ball serves DOWN (+1) toward player.
            serve(court.w, court.h, who === "p1" ? -1 : 1);
            setHudFlash(0);
          }
        }, 700);
      }
      return next;
    });
    setBestRally(rallyBestRef.current).catch(() => {});
  };

  const finishRound = (finalScore: { p1: number; p2: number }, winnerSide: "p1" | "p2") => {
    hapticHeavy();
    if (mode === "local2p" || winnerSide === "p1") {
      playSfx("win", 0.9);
    } else {
      playSfx("lose", 0.9);
    }
    stopLoop("ambient_drone");
    incGamesPlayed().catch(() => {});
    const localWin = mode === "local2p" || winnerSide === "p1";
    if (localWin) incWinStreak().catch(() => {});
    else resetWinStreak().catch(() => {});

    // Show interstitial on game over (with 90s frequency cap)
    if (!adsRemoved && canShowInterstitial(lastInterstitialTime.current)) {
      lastInterstitialTime.current = Date.now();
      showInterstitial().then(() => loadInterstitial()).catch(() => {});
    }

    if (mode === "campaign") {
      const earned = starsEarned(level, finalScore.p1, finalScore.p2);
      if (earned > 0) setCampaignStars(level.id, earned).catch(() => {});
    } else if (mode === "daily") {
      setDailyBest(todayKey(), finalScore.p1).catch(() => {});
    } else if (mode === "quick") {
      setQuickBest(rallyBestRef.current).catch(() => {});
      const margin = finalScore.p1 - finalScore.p2;
      const adj = margin >= 3 ? 0.07 : margin <= -3 ? -0.07 : margin > 0 ? 0.03 : -0.03;
      cpuSkillRef.current = Math.max(0.3, Math.min(0.97, cpuSkillRef.current + adj));
      cpuSkillShared.value = cpuSkillRef.current;
    }
  };

  // ===== Frame callback (UI thread) =====
  useFrameCallback((info) => {
    "worklet";
    if (phase.value !== PH_PLAYING) return;
    const dtRaw = info.timeSincePreviousFrame ?? 16;
    const dt = Math.min(dtRaw, 32) / 1000;
    const w = courtW.value;
    const h = courtH.value;
    if (w <= 0 || h <= 0) return;

    // Paddle smoothing (horizontal axis)
    const ease = 1 - Math.pow(0.001, dt);
    p1x.value += (p1tx.value - p1x.value) * ease;
    p2x.value += (p2tx.value - p2x.value) * ease;

    // Paddle horizontal velocity, low-pass filtered (for curve detection)
    if (dt > 0) {
      p1Vel.value = p1Vel.value * 0.55 + ((p1x.value - p1PrevX.value) / dt) * 0.45;
      p2Vel.value = p2Vel.value * 0.55 + ((p2x.value - p2PrevX.value) / dt) * 0.45;
    }
    p1PrevX.value = p1x.value;
    p2PrevX.value = p2x.value;

    // Curve marker decay
    if (curveFx.value > 0) {
      curveFx.value = Math.max(0, curveFx.value - dt * 1.2);
    }

    // Speed ramp on ball
    if (ballSpeedFactor.value < 1) {
      const prev = ballSpeedFactor.value;
      const next = Math.min(1, prev + dt / SERVE_RAMP_SECONDS);
      ballSpeedFactor.value = next;
      const ratio = next / prev;
      bvx.value *= ratio;
      bvy.value *= ratio;
      if (b2Active.value > 0) {
        b2vx.value *= ratio;
        b2vy.value *= ratio;
      }
    }

    // CPU AI — drives the TOP paddle (p2). Tracks ball X when ball moves upward (toward CPU).
    if (cpuSkillShared.value > 0) {
      let tx = bx.value;
      let ty = by.value;
      let tvy = bvy.value;
      if (b2Active.value > 0) {
        const main = bvy.value < 0; // moving toward top (CPU)
        const second = b2vy.value < 0;
        if (main && !second) {
          tx = bx.value; ty = by.value; tvy = bvy.value;
        } else if (!main && second) {
          tx = b2x.value; ty = b2y.value; tvy = b2vy.value;
        } else {
          // both same direction: pick the one closer in Y to CPU edge
          const d1 = bx.value !== undefined ? ty : 0;
          const d2 = b2y.value;
          if (Math.abs(d2 - PADDLE_INSET) < Math.abs(ty - PADDLE_INSET)) {
            tx = b2x.value; ty = b2y.value; tvy = b2vy.value;
          }
          // dummy use to silence "unused" - d1 already used as ty
          void d1;
        }
      }
      const aim = tvy < 0 ? tx : w / 2;
      const err = (1 - cpuSkillShared.value) * 80 * Math.sin(ty * 0.01);
      const desired = aim + err;
      const maxSpeed = 160 + cpuSkillShared.value * 700;
      const diff = desired - p2tx.value;
      const step = Math.max(-maxSpeed * dt, Math.min(maxSpeed * dt, diff));
      p2tx.value += step;
    }

    // Clamp paddles within court
    const halfP = paddleW.value / 2;
    if (p1x.value < halfP) p1x.value = halfP;
    if (p1x.value > w - halfP) p1x.value = w - halfP;
    if (p2x.value < halfP) p2x.value = halfP;
    if (p2x.value > w - halfP) p2x.value = w - halfP;
    if (p1tx.value < halfP) p1tx.value = halfP;
    if (p1tx.value > w - halfP) p1tx.value = w - halfP;
    if (p2tx.value < halfP) p2tx.value = halfP;
    if (p2tx.value > w - halfP) p2tx.value = w - halfP;

    // Apply curve (perpendicular acceleration). Direction-invariant formula.
    if (ballCurve.value !== 0) {
      const sp = Math.hypot(bvx.value, bvy.value) || 1;
      const px = -bvy.value / sp;
      const py = bvx.value / sp;
      bvx.value += px * ballCurve.value * dt;
      bvy.value += py * ballCurve.value * dt;
      ballCurve.value *= Math.max(0, 1 - dt * 1.6);
      if (Math.abs(ballCurve.value) < 8) ballCurve.value = 0;
    }

    // Move ball
    bx.value += bvx.value * dt;
    by.value += bvy.value * dt;

    // Wall bounces — LEFT and RIGHT walls in portrait
    if (bx.value < BALL_R) {
      bx.value = BALL_R;
      bvx.value = -bvx.value;
      runOnJS(onWallHit)();
    } else if (bx.value > w - BALL_R) {
      bx.value = w - BALL_R;
      bvx.value = -bvx.value;
      runOnJS(onWallHit)();
    }

    // Paddle collisions
    const topPaddleY = PADDLE_INSET + PADDLE_THICK;   // bottom edge of TOP paddle
    const bottomPaddleY = h - PADDLE_INSET - PADDLE_THICK; // top edge of BOTTOM paddle
    const CURVE_THRESHOLD = 280;
    const CURVE_SCALE = 1.5;
    const CURVE_MAX = 1400;

    // TOP paddle (p2 — CPU or P2 in local2p): ball moving up (bvy < 0)
    // Continuous Collision Detection: check if ball crossed paddle plane between frames
    if (bvy.value < 0) {
      const prevY = by.value - bvy.value * dt;
      const prevX = bx.value - bvx.value * dt;
      const crossedPaddle = prevY - BALL_R > topPaddleY && by.value - BALL_R <= topPaddleY;
      if (crossedPaddle) {
        const t = (topPaddleY - (prevY - BALL_R)) / ((by.value - BALL_R) - (prevY - BALL_R));
        const intersectX = prevX + (bx.value - prevX) * t;
        if (intersectX >= p2x.value - halfP - BALL_R && intersectX <= p2x.value + halfP + BALL_R) {
          by.value = topPaddleY + BALL_R;
          const offset = (intersectX - p2x.value) / halfP;
          const speed = Math.hypot(bvx.value, bvy.value) * level.speedUp;
          const downAngle = Math.PI / 2 + offset * 0.9 * level.spin;
          bvx.value = Math.cos(downAngle) * speed + offset * 80;
          bvy.value = Math.sin(downAngle) * speed;
          const pv = p2Vel.value;
          if (Math.abs(pv) > CURVE_THRESHOLD) {
            const mag = Math.min(CURVE_MAX, (Math.abs(pv) - CURVE_THRESHOLD) * CURVE_SCALE);
            ballCurve.value = -Math.sign(pv) * mag;
            curveFx.value = 1;
            runOnJS(onCurveHit)();
          } else {
            ballCurve.value = 0;
          }
          rallyShared.value += 1;
          runOnJS(onPaddleHit)();
        }
      }
    }

    // BOTTOM paddle (p1 — player): ball moving down (bvy > 0)
    // Continuous Collision Detection: check if ball crossed paddle plane between frames
    if (bvy.value > 0) {
      const prevY = by.value - bvy.value * dt;
      const prevX = bx.value - bvx.value * dt;
      const crossedPaddle = prevY + BALL_R < bottomPaddleY && by.value + BALL_R >= bottomPaddleY;
      if (crossedPaddle) {
        const t = (bottomPaddleY - (prevY + BALL_R)) / ((by.value + BALL_R) - (prevY + BALL_R));
        const intersectX = prevX + (bx.value - prevX) * t;
        if (intersectX >= p1x.value - halfP - BALL_R && intersectX <= p1x.value + halfP + BALL_R) {
          by.value = bottomPaddleY - BALL_R;
          const offset = (intersectX - p1x.value) / halfP;
          const speed = Math.hypot(bvx.value, bvy.value) * level.speedUp;
          const upAngle = -Math.PI / 2 + offset * 0.9 * level.spin;
          bvx.value = Math.cos(upAngle) * speed + offset * 80;
          bvy.value = Math.sin(upAngle) * speed;
          const pv = p1Vel.value;
          if (Math.abs(pv) > CURVE_THRESHOLD) {
            const mag = Math.min(CURVE_MAX, (Math.abs(pv) - CURVE_THRESHOLD) * CURVE_SCALE);
            ballCurve.value = Math.sign(pv) * mag;
            curveFx.value = 1;
            runOnJS(onCurveHit)();
          } else {
            ballCurve.value = 0;
          }
          rallyShared.value += 1;
          runOnJS(onPaddleHit)();
        }
      }
    }

    // Obstacles — horizontal bars at vertical positions
    if (obstacleCount.value > 0) {
      if (obstacleMoving.value > 0) {
        obstaclePhase.value += dt * 1.2;
      }
      // Obstacles oscillate HORIZONTALLY (across the court) in portrait
      const offsetX = obstacleMoving.value > 0 ? Math.sin(obstaclePhase.value) * (w * 0.08) : 0;
      const oxBase = w / 2 - OBSTACLE_LEN / 2;
      const ys: number[] = [];
      if (obstacleCount.value === 1) {
        ys.push(h / 2 - OBSTACLE_THICK / 2);
      } else if (obstacleCount.value === 2) {
        ys.push(h * 0.34 - OBSTACLE_THICK / 2);
        ys.push(h * 0.66 - OBSTACLE_THICK / 2);
      } else {
        ys.push(h * 0.28 - OBSTACLE_THICK / 2);
        ys.push(h * 0.5 - OBSTACLE_THICK / 2);
        ys.push(h * 0.72 - OBSTACLE_THICK / 2);
      }
      for (let i = 0; i < ys.length; i++) {
        const oy = ys[i];
        const sign = i % 2 === 0 ? 1 : -1;
        const ox = oxBase + offsetX * sign;
        if (
          bx.value + BALL_R > ox &&
          bx.value - BALL_R < ox + OBSTACLE_LEN &&
          by.value + BALL_R > oy &&
          by.value - BALL_R < oy + OBSTACLE_THICK
        ) {
          const overlapX =
            bvx.value > 0 ? bx.value + BALL_R - ox : ox + OBSTACLE_LEN - (bx.value - BALL_R);
          const overlapY =
            bvy.value > 0 ? by.value + BALL_R - oy : oy + OBSTACLE_THICK - (by.value - BALL_R);
          if (overlapX < overlapY) {
            bvx.value = -bvx.value;
            bx.value += bvx.value > 0 ? 2 : -2;
          } else {
            bvy.value = -bvy.value;
            by.value += bvy.value > 0 ? 2 : -2;
          }
          ballCurve.value *= 0.4;
          runOnJS(onWallHit)();
          break;
        }
      }
    }

    // Secondary ball
    if (b2Active.value > 0) {
      if (ball2Curve.value !== 0) {
        const sp2 = Math.hypot(b2vx.value, b2vy.value) || 1;
        const px = -b2vy.value / sp2;
        const py = b2vx.value / sp2;
        b2vx.value += px * ball2Curve.value * dt;
        b2vy.value += py * ball2Curve.value * dt;
        ball2Curve.value *= Math.max(0, 1 - dt * 1.6);
        if (Math.abs(ball2Curve.value) < 8) ball2Curve.value = 0;
      }
      b2x.value += b2vx.value * dt;
      b2y.value += b2vy.value * dt;
      if (b2x.value < BALL_R) { b2x.value = BALL_R; b2vx.value = -b2vx.value; }
      else if (b2x.value > w - BALL_R) { b2x.value = w - BALL_R; b2vx.value = -b2vx.value; }

      // Top paddle (ball2) — CCD
      if (b2vy.value < 0) {
        const prevY2 = b2y.value - b2vy.value * dt;
        const prevX2 = b2x.value - b2vx.value * dt;
        const crossedPaddle2 = prevY2 - BALL_R > topPaddleY && b2y.value - BALL_R <= topPaddleY;
        if (crossedPaddle2) {
          const t2 = (topPaddleY - (prevY2 - BALL_R)) / ((b2y.value - BALL_R) - (prevY2 - BALL_R));
          const intersectX2 = prevX2 + (b2x.value - prevX2) * t2;
          if (intersectX2 >= p2x.value - halfP - BALL_R && intersectX2 <= p2x.value + halfP + BALL_R) {
            b2y.value = topPaddleY + BALL_R;
            const offset = (intersectX2 - p2x.value) / halfP;
            const speed = Math.hypot(b2vx.value, b2vy.value) * level.speedUp;
            const downAngle = Math.PI / 2 + offset * 0.9 * level.spin;
            b2vx.value = Math.cos(downAngle) * speed + offset * 80;
            b2vy.value = Math.sin(downAngle) * speed;
            const pv = p2Vel.value;
            if (Math.abs(pv) > CURVE_THRESHOLD) {
              ball2Curve.value =
                -Math.sign(pv) * Math.min(CURVE_MAX, (Math.abs(pv) - CURVE_THRESHOLD) * CURVE_SCALE);
              curveFx.value = 1;
            } else {
              ball2Curve.value = 0;
            }
          }
        }
      }
      // Bottom paddle
      // Bottom paddle (ball2) — CCD
      if (b2vy.value > 0) {
        const prevY2 = b2y.value - b2vy.value * dt;
        const prevX2 = b2x.value - b2vx.value * dt;
        const crossedPaddle2 = prevY2 + BALL_R < bottomPaddleY && b2y.value + BALL_R >= bottomPaddleY;
        if (crossedPaddle2) {
          const t2 = (bottomPaddleY - (prevY2 + BALL_R)) / ((b2y.value + BALL_R) - (prevY2 + BALL_R));
          const intersectX2 = prevX2 + (b2x.value - prevX2) * t2;
          if (intersectX2 >= p1x.value - halfP - BALL_R && intersectX2 <= p1x.value + halfP + BALL_R) {
            b2y.value = bottomPaddleY - BALL_R;
            const offset = (intersectX2 - p1x.value) / halfP;
            const speed = Math.hypot(b2vx.value, b2vy.value) * level.speedUp;
            const upAngle = -Math.PI / 2 + offset * 0.9 * level.spin;
            b2vx.value = Math.cos(upAngle) * speed + offset * 80;
            b2vy.value = Math.sin(upAngle) * speed;
            const pv = p1Vel.value;
            if (Math.abs(pv) > CURVE_THRESHOLD) {
              ball2Curve.value =
                Math.sign(pv) * Math.min(CURVE_MAX, (Math.abs(pv) - CURVE_THRESHOLD) * CURVE_SCALE);
              curveFx.value = 1;
            } else {
              ball2Curve.value = 0;
            }
          }
        }
      }
      // Obstacle collisions for ball 2
      if (obstacleCount.value > 0) {
        const offsetX = obstacleMoving.value > 0 ? Math.sin(obstaclePhase.value) * (w * 0.08) : 0;
        const oxBase = w / 2 - OBSTACLE_LEN / 2;
        const ys: number[] = [];
        if (obstacleCount.value === 1) {
          ys.push(h / 2 - OBSTACLE_THICK / 2);
        } else if (obstacleCount.value === 2) {
          ys.push(h * 0.34 - OBSTACLE_THICK / 2);
          ys.push(h * 0.66 - OBSTACLE_THICK / 2);
        } else {
          ys.push(h * 0.28 - OBSTACLE_THICK / 2);
          ys.push(h * 0.5 - OBSTACLE_THICK / 2);
          ys.push(h * 0.72 - OBSTACLE_THICK / 2);
        }
        for (let i = 0; i < ys.length; i++) {
          const oy = ys[i];
          const sign = i % 2 === 0 ? 1 : -1;
          const ox = oxBase + offsetX * sign;
          if (
            b2x.value + BALL_R > ox &&
            b2x.value - BALL_R < ox + OBSTACLE_LEN &&
            b2y.value + BALL_R > oy &&
            b2y.value - BALL_R < oy + OBSTACLE_THICK
          ) {
            const overlapX =
              b2vx.value > 0 ? b2x.value + BALL_R - ox : ox + OBSTACLE_LEN - (b2x.value - BALL_R);
            const overlapY =
              b2vy.value > 0 ? b2y.value + BALL_R - oy : oy + OBSTACLE_THICK - (b2y.value - BALL_R);
            if (overlapX < overlapY) {
              b2vx.value = -b2vx.value;
              b2x.value += b2vx.value > 0 ? 2 : -2;
            } else {
              b2vy.value = -b2vy.value;
              b2y.value += b2vy.value > 0 ? 2 : -2;
            }
            ball2Curve.value *= 0.4;
            break;
          }
        }
      }

      if (b2y.value < -BALL_R) {
        b2Active.value = 0;
        runOnJS(onScored)("p1"); // ball went off TOP → p1 (bottom player) scored
      } else if (b2y.value > h + BALL_R) {
        b2Active.value = 0;
        runOnJS(onScored)("p2"); // ball went off BOTTOM → p2 (CPU/top) scored
      }
    }

    // Main ball score
    if (by.value < -BALL_R) {
      phase.value = PH_SCORED;
      runOnJS(onScored)("p1");
    } else if (by.value > h + BALL_R) {
      phase.value = PH_SCORED;
      runOnJS(onScored)("p2");
    }
  });

  // Local 2P disables CPU AI on top paddle
  useEffect(() => {
    if (mode === "local2p") {
      cpuSkillShared.value = 0;
    } else {
      cpuSkillShared.value = level.cpuSkill;
      cpuSkillRef.current = level.cpuSkill;
    }
  }, [mode, level.cpuSkill, cpuSkillShared]);

  // Sync paddle width to level
  useEffect(() => {
    paddleW.value = PADDLE_BASE_W * level.paddleSize;
  }, [level.paddleSize, paddleW]);

  // Sync obstacles
  useEffect(() => {
    obstacleCount.value = level.obstacleCount;
    obstacleMoving.value = level.obstacleMoving ? 1 : 0;
    obstaclePhase.value = 0;
  }, [level.obstacleCount, level.obstacleMoving, obstacleCount, obstacleMoving, obstaclePhase]);

  useEffect(() => {
    return () => {
      cancelAnimation(bx);
      cancelAnimation(by);
    };
  }, [bx, by]);

  // ===== Pause / restart =====
  const togglePause = () => {
    if (phaseJS === "ended") return;
    if (paused) {
      setPaused(false);
      phase.value = PH_PLAYING;
      setPhaseJS("playing");
      startLoop("ambient_drone", 0.35);
    } else {
      setPaused(true);
      phase.value = PH_READY;
      setPhaseJS("ready");
      stopLoop("ambient_drone");
    }
  };

  const restartRound = () => {
    setScore({ p1: 0, p2: 0 });
    setWinner(null);
    rallyBestRef.current = 0;
    if (court.w && court.h) {
      serve(court.w, court.h, Math.random() > 0.5 ? 1 : -1);
    }
  };

  // ===== Gestures (horizontal drag now) =====
const courtGesture = useMemo(
  () =>
    Gesture.Manual()
      .onTouchesDown((e, manager) => {
        "worklet";
        for (const touch of e.allTouches) {
          const half = courtH.value / 2;
          if (touch.y > half) {
            p1tx.value = touch.x;
          } else {
            p2tx.value = touch.x;
          }
        }
        manager.activate();
      })
      .onTouchesMove((e, manager) => {
        "worklet";
        for (const touch of e.changedTouches) {
          const half = courtH.value / 2;
          if (touch.y > half) {
            p1tx.value = touch.x;
          } else {
            p2tx.value = touch.x;
          }
        }
      }),
  [p1tx, p2tx, courtH],
);

  // ===== Animated styles =====
  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: bx.value - BALL_R },
      { translateY: by.value - BALL_R },
    ],
  }));
  const ball2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: b2x.value - BALL_R },
      { translateY: b2y.value - BALL_R },
    ],
    opacity: b2Active.value,
  }));
  // Paddles now use translateX. Width is animated.
  const p1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: p1x.value - paddleW.value / 2 }],
    width: paddleW.value,
  }));
  const p2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: p2x.value - paddleW.value / 2 }],
    width: paddleW.value,
  }));
  const trailStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: bx.value - BALL_R - bvx.value * (0.02 + curveFx.value * 0.04) },
      { translateY: by.value - BALL_R - bvy.value * (0.02 + curveFx.value * 0.04) },
      { scale: 1.6 + curveFx.value * 0.8 },
    ],
    opacity: 0.45 + curveFx.value * 0.4,
  }));
  const curveHintStyle = useAnimatedStyle(() => ({
    opacity: curveFx.value,
    transform: [{ scale: 0.95 + curveFx.value * 0.1 }],
  }));

  const handleContinue = async () => {
    const success = await showRewarded();
    if (success) {
      loadRewarded();
      setCanContinue(false);
      setPhaseJS("playing");
      phase.value = PH_PLAYING;
      startLoop("ambient_drone", 0.35);
      if (court.w && court.h) {
        serve(court.w, court.h, 1); // serve toward player
      }
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]} testID="game-screen">
      <LinearGradient
        colors={[theme.bgGradientTop, theme.bgGradientBottom]}
        style={StyleSheet.absoluteFill}
      />

      {theme.scanlines && <Scanlines color={theme.text} />}

{/* Ad Banner at top */}
      {!adsRemoved && (
      <View style={styles.adContainer}>
        <BannerAd
          unitId={BANNER_AD_UNIT_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => console.log('Ad loaded')}
          onAdFailedToLoad={(error) => console.error('Ad failed:', error)}
        />
      </View>
      )}

      {/* HUD — top row: back, score, pause (pushed down by banner) */}
      {/* HUD — top row: back, score, pause */}
      <View
        style={[
          styles.hud,
          {
            paddingTop: insets.top + BANNER_HEIGHT + 8,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={async () => {
            playSfx("menu_back", 0.7);
            setPaused(false);
            phase.value = PH_READY;
            if (!adsRemoved && canShowInterstitial(lastInterstitialTime.current)) {
              lastInterstitialTime.current = Date.now();
              await showInterstitial().catch(() => {});
              loadInterstitial();
            }
            if (mode === "campaign") onCampaignBack();
            else onExit();
          }}
          style={styles.hudBtn}
          testID="game-back-button"
          hitSlop={12}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>

        <View style={styles.scoreWrap} pointerEvents="none">
          <Text
            style={[styles.scoreText, { color: hudFlash && score.p1 > score.p2 ? theme.accent : theme.text }]}
            testID="score-p1"
          >
            {score.p1}
          </Text>
          <Text style={[styles.scoreSep, { color: theme.textMuted }]}>·</Text>
          <Text
            style={[styles.scoreText, { color: hudFlash && score.p2 > score.p1 ? theme.accent : theme.text }]}
            testID="score-p2"
          >
            {score.p2}
          </Text>
        </View>

        <View style={styles.hudRight}>
          <View style={styles.rallyPill}>
            <Text style={[styles.rallyText, { color: theme.textMuted }]}>RALLY</Text>
            <Text style={[styles.rallyNum, { color: theme.accent }]} testID="rally-count">
              {rally}
            </Text>
          </View>
          <Pressable
            onPress={togglePause}
            style={styles.hudBtn}
            testID="game-pause-button"
            hitSlop={12}
          >
            <Ionicons name={paused ? "play" : "pause"} size={18} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Mode label */}
      <Text
        style={[styles.modeLabel, { color: theme.textMuted, top: insets.top + BANNER_HEIGHT + 56 }]}
      >
        {labelForMode(mode, level)}  ·  FIRST TO {level.target}
      </Text>

      {/* Curve hint pill */}
      <Animated.View
        style={[
          styles.curveHint,
          {
            top: insets.top + BANNER_HEIGHT + 76,
            borderColor: theme.accent,
            backgroundColor: theme.bg,
          },
          curveHintStyle,
        ]}
        pointerEvents="none"
      >
        <Ionicons name="git-branch" size={11} color={theme.accent} />
        <Text style={[styles.curveHintText, { color: theme.accent }]}>CURVE</Text>
      </Animated.View>

      {/* Court — fills remaining space, paddles top + bottom */}
      <View
        style={[
          styles.court,
          {
            marginTop: insets.top + BANNER_HEIGHT + 96,
            marginBottom: insets.bottom + 16,
            marginLeft: insets.left + 12,
            marginRight: insets.right + 12,
          },
        ]}
        onLayout={onLayout}
        testID="game-court"
      >
        <CenterLine color={theme.centerLine} />

        {/* Obstacles */}
        {level.obstacleCount > 0 && court.h > 0 && (
          <Obstacles
            count={level.obstacleCount}
            moving={level.obstacleMoving}
            courtW={court.w}
            courtH={court.h}
            phase={obstaclePhase}
            theme={theme}
          />
        )}

        {/* Touch zones — top half + bottom half */}
	<GestureDetector gesture={courtGesture}>
	  <View style={styles.courtOverlay} testID="court-touch-overlay" />
	</GestureDetector>

        {/* Paddles + ball — gated on layout */}
        {court.w > 0 && (
          <>
            <Animated.View
              style={[
                styles.paddleTop,
                { top: PADDLE_INSET, backgroundColor: theme.paddle, shadowColor: theme.paddleShadow },
                p2Style,
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.paddleBottom,
                { bottom: PADDLE_INSET, backgroundColor: theme.paddle, shadowColor: theme.paddleShadow },
                p1Style,
              ]}
              pointerEvents="none"
            />

            {/* Trail */}
            <Animated.View
              style={[
                styles.ball,
                { backgroundColor: theme.trail, shadowColor: "transparent" },
                trailStyle,
              ]}
              pointerEvents="none"
            />

            {/* Ball */}
            <Animated.View
              style={[
                styles.ball,
                { backgroundColor: theme.ball, shadowColor: theme.ballGlow },
                ballStyle,
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.ball,
                { backgroundColor: theme.ball, shadowColor: theme.ballGlow },
                ball2Style,
              ]}
              pointerEvents="none"
            />
          </>
        )}
      </View>

      {/* Pause overlay */}
      {paused && phaseJS !== "ended" && (
        <Overlay theme={theme}>
          <Text style={[styles.overlayTitle, { color: theme.text }]}>Paused</Text>
          <Text style={[styles.overlaySub, { color: theme.textMuted }]}>
            Tap resume to keep playing
          </Text>
          <View style={styles.overlayRow}>
            <OverlayBtn theme={theme} label="Resume" primary onPress={togglePause} testID="resume-button" />
            <OverlayBtn theme={theme} label="Restart" onPress={() => { setPaused(false); restartRound(); }} testID="restart-button" />
            <OverlayBtn theme={theme} label="Quit" onPress={() => (mode === "campaign" ? onCampaignBack() : onExit())} testID="quit-button" />
          </View>
        </Overlay>
      )}

      {/* End overlay */}
      {phaseJS === "ended" && winner && (
        <EndOverlay
          theme={theme}
          mode={mode}
          level={level}
          score={score}
          rally={rallyBestRef.current}
          winner={winner}
          adsRemoved={adsRemoved}
          canContinue={canContinue}
          onRestart={restartRound}
          onExit={() => (mode === "campaign" ? onCampaignBack() : onExit())}
          onContinue={handleContinue}
        />
      )}
    </View>
  );
}

function starsEarned(level: LevelConfig, p1: number, p2: number): number {
  if (p1 < level.target) return 0;
  if (p2 <= level.stars[0]) return 3;
  if (p2 <= level.stars[1]) return 2;
  if (p2 <= level.stars[2]) return 1;
  return 1;
}

function labelForMode(mode: Mode, level: LevelConfig): string {
  if (mode === "campaign") return `CAMPAIGN · ${level.name}`;
  if (mode === "quick") return "QUICK MATCH";
  if (mode === "daily") return level.name.toUpperCase();
  return "LOCAL 2P";
}

// HORIZONTAL center line (was vertical in landscape)
function CenterLine({ color }: { color: string }) {
  const dashes = Array.from({ length: 14 }, (_, i) => i);
  return (
    <View style={styles.centerLine} pointerEvents="none">
      {dashes.map((i) => (
        <View
          key={i}
          style={{
            height: 2,
            width: 12,
            backgroundColor: color,
            marginHorizontal: 6,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

function Scanlines({ color }: { color: string }) {
  const lines = Array.from({ length: 100 }, (_, i) => i);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines.map((i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * 6,
            height: 1,
            backgroundColor: color,
            opacity: 0.04,
          }}
        />
      ))}
    </View>
  );
}

function Obstacles({
  count,
  moving,
  courtW,
  courtH,
  phase,
  theme,
}: {
  count: number;
  moving: boolean;
  courtW: number;
  courtH: number;
  phase: Animated.SharedValue<number>;
  theme: Theme;
}) {
  const positions: { baseY: number; sign: 1 | -1 }[] = [];
  if (count === 1) {
    positions.push({ baseY: courtH / 2 - OBSTACLE_THICK / 2, sign: 1 });
  } else if (count === 2) {
    positions.push({ baseY: courtH * 0.34 - OBSTACLE_THICK / 2, sign: 1 });
    positions.push({ baseY: courtH * 0.66 - OBSTACLE_THICK / 2, sign: -1 });
  } else {
    positions.push({ baseY: courtH * 0.28 - OBSTACLE_THICK / 2, sign: 1 });
    positions.push({ baseY: courtH * 0.5 - OBSTACLE_THICK / 2, sign: -1 });
    positions.push({ baseY: courtH * 0.72 - OBSTACLE_THICK / 2, sign: 1 });
  }
  return (
    <>
      {positions.map((p, i) => (
        <ObstacleBar
          key={i}
          baseY={p.baseY}
          sign={p.sign}
          courtW={courtW}
          phase={phase}
          moving={moving}
          theme={theme}
        />
      ))}
    </>
  );
}

function ObstacleBar({
  baseY,
  sign,
  courtW,
  phase,
  moving,
  theme,
}: {
  baseY: number;
  sign: 1 | -1;
  courtW: number;
  phase: Animated.SharedValue<number>;
  moving: boolean;
  theme: Theme;
}) {
  const animStyle = useAnimatedStyle(() => {
    const offsetX = moving ? Math.sin(phase.value) * (courtW * 0.08) * sign : 0;
    return {
      transform: [
        { translateX: courtW / 2 - OBSTACLE_LEN / 2 + offsetX },
        { translateY: baseY },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.obstacle,
        {
          backgroundColor: theme.paddle,
          width: OBSTACLE_LEN,
          height: OBSTACLE_THICK,
          shadowColor: theme.paddleShadow,
        },
        animStyle,
      ]}
      pointerEvents="none"
    />
  );
}

function Overlay({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <View style={styles.overlayWrap} pointerEvents="box-none">
      <View
        style={[
          styles.overlayCard,
          {
            backgroundColor: theme.bg,
            borderColor: "rgba(255,255,255,0.08)",
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function OverlayBtn({
  theme,
  label,
  onPress,
  primary,
  testID,
}: {
  theme: Theme;
  label: string;
  onPress: () => void | Promise<void>;
  primary?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      onPress={() => {
        playSfx(primary ? "menu_select" : "menu_back", 0.7);
        onPress();
      }}
      testID={testID}
      style={({ pressed }) => [
        styles.ovBtn,
        {
          backgroundColor: primary ? theme.accent : "rgba(255,255,255,0.06)",
          borderColor: primary ? theme.accent : "rgba(255,255,255,0.1)",
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text style={[styles.ovBtnLabel, { color: primary ? "#0A0A0F" : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function EndOverlay({
  theme,
  mode,
  level,
  score,
  rally,
  winner,
  adsRemoved,
  canContinue,
  onRestart,
  onExit,
  onContinue,
}: {
  theme: Theme;
  mode: Mode;
  level: LevelConfig;
  score: { p1: number; p2: number };
  rally: number;
  winner: "p1" | "p2";
  adsRemoved: boolean;
  canContinue: boolean;
  onRestart: () => void;
  onExit: () => void;
  onContinue: () => void | Promise<void>;
}) {
  const youWon = winner === "p1";
  const title =
    mode === "local2p"
      ? winner === "p1"
        ? "Player 1 Wins"
        : "Player 2 Wins"
      : youWon
        ? "Victory"
        : "Defeated";
  const stars =
    mode === "campaign" && youWon ? starsEarned(level, score.p1, score.p2) : 0;

  return (
    <Overlay theme={theme}>
      <Text
        style={[styles.overlayTitle, { color: youWon || mode === "local2p" ? theme.accent : theme.text }]}
        testID="end-title"
      >
        {title}
      </Text>
      <View style={styles.bigScoreRow}>
        <Text style={[styles.bigScore, { color: theme.text }]}>{score.p1}</Text>
        <Text style={[styles.bigScoreSep, { color: theme.textMuted }]}>—</Text>
        <Text style={[styles.bigScore, { color: theme.text }]}>{score.p2}</Text>
      </View>
      {mode === "campaign" && youWon && (
        <View style={styles.starsRow}>
          {[0, 1, 2].map((i) => (
            <Ionicons
              key={i}
              name={i < stars ? "star" : "star-outline"}
              size={28}
              color={i < stars ? theme.accent : theme.textMuted}
            />
          ))}
        </View>
      )}
      <Text style={[styles.overlaySub, { color: theme.textMuted }]}>
        Longest rally · {rally} hits
      </Text>
      <View style={styles.overlayRow}>
        {canContinue && (
          <OverlayBtn theme={theme} label="▶ Continue" primary onPress={onContinue} testID="continue-button" />
        )}
        <OverlayBtn theme={theme} label="Play Again" primary={!canContinue} onPress={async () => {
          if (!adsRemoved && canShowInterstitial(Date.now() - 100000)) {
            await showInterstitial().catch(() => {});
            loadInterstitial();
          }
          onRestart();
        }} testID="play-again-button" />
        <OverlayBtn theme={theme} label="Exit" onPress={async () => {
          if (!adsRemoved && canShowInterstitial(Date.now() - 100000)) {
            await showInterstitial().catch(() => {});
            loadInterstitial();
          }
          onExit();
        }} testID="end-exit-button" />
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  adContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    height: BANNER_HEIGHT,
    backgroundColor: "transparent",
  },
  root: { flex: 1 },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  hudBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  hudRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  rallyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  rallyText: { fontSize: 9, letterSpacing: 2, fontWeight: "700" },
  rallyNum: { fontSize: 13, fontWeight: "800" },
  scoreWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreText: { fontSize: 28, fontWeight: "800", letterSpacing: -1, minWidth: 24, textAlign: "center" },
  scoreSep: { fontSize: 22, fontWeight: "700" },
  modeLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "700",
  },
  curveHint: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  curveHintText: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  court: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.015)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  // Horizontal dashed line across the middle of the court (portrait)
  centerLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -1 }],
  },
  // Paddles run horizontally; left position is driven by transform translateX.
  paddleTop: {
    position: "absolute",
    left: 0,
    height: PADDLE_THICK,
    borderRadius: PADDLE_THICK / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 6,
  },
  paddleBottom: {
    position: "absolute",
    left: 0,
    height: PADDLE_THICK,
    borderRadius: PADDLE_THICK / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 6,
  },
  ball: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BALL_R * 2,
    height: BALL_R * 2,
    borderRadius: BALL_R,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
  },
  obstacle: {
    position: "absolute",
    top: 0,
    left: 0,
    borderRadius: 3,
    opacity: 0.85,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  touchZoneBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  touchZoneTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayCard: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 280,
    maxWidth: 360,
    gap: 6,
  },
  overlayTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  overlaySub: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  overlayRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  ovBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  ovBtnLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  bigScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  bigScore: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  bigScoreSep: { fontSize: 24, fontWeight: "600" },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
});