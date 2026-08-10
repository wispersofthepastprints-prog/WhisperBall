// particles.ts - Visual juice system for Whisper Ball
// Particle trails, screen shake, glow effects, score popups

import { SharedValue, useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withDelay, runOnJS } from "react-native-reanimated";
import { StyleSheet } from "react-native";

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'trail' | 'spark' | 'explosion' | 'score';
}

export interface ScreenShake {
  intensity: number;
  duration: number;
  startTime: number;
}

export class ParticleSystem {
  particles: Particle[] = [];
  nextId = 0;
  screenShake: ScreenShake | null = null;

  // Ball trail
  addTrail(x: number, y: number, speed: number, theme: string): void {
    const count = Math.min(3, Math.floor(speed / 2));
    for (let i = 0; i < count; i++) {
      this.particles.push({
        id: this.nextId++,
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 1,
        maxLife: 20 + Math.random() * 15,
        size: 2 + Math.random() * 3,
        color: this.getTrailColor(theme),
        type: 'trail',
      });
    }
  }

  // Paddle hit spark
  addSpark(x: number, y: number, paddleVelocity: number, theme: string): void {
    const count = 8 + Math.floor(Math.abs(paddleVelocity) * 2);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4 + Math.abs(paddleVelocity) * 0.3;
      this.particles.push({
        id: this.nextId++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 15 + Math.random() * 20,
        size: 2 + Math.random() * 3,
        color: this.getSparkColor(theme),
        type: 'spark',
      });
    }
  }

  // Score popup
  addScorePopup(x: number, y: number, score: string, isPlayer: boolean): void {
    this.particles.push({
      id: this.nextId++,
      x,
      y,
      vx: 0,
      vy: -2,
      life: 1,
      maxLife: 45,
      size: 0, // used as text size indicator
      color: isPlayer ? '#10B981' : '#EF4444',
      type: 'score',
    });
  }

  // Rally milestone explosion
  addRallyExplosion(x: number, y: number, rallyCount: number, theme: string): void {
    const count = Math.min(30, 10 + rallyCount);
    const colors = rallyCount >= 50 
      ? ['#FFD700', '#FFA500', '#FF4500', '#FF1493']
      : rallyCount >= 25
      ? ['#C9A227', '#FFD700', '#FFA500']
      : ['#C9A227', '#FFFFFF'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 3 + Math.random() * 5;
      this.particles.push({
        id: this.nextId++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 30 + Math.random() * 30,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'explosion',
      });
    }

    // Trigger screen shake
    this.screenShake = {
      intensity: Math.min(15, rallyCount * 0.3),
      duration: 200 + rallyCount * 5,
      startTime: Date.now(),
    };
  }

  update(): void {
    const now = Date.now();

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 1 / p.maxLife;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Clear expired screen shake
    if (this.screenShake && now - this.screenShake.startTime > this.screenShake.duration) {
      this.screenShake = null;
    }
  }

  getScreenShakeOffset(): { x: number; y: number } {
    if (!this.screenShake) return { x: 0, y: 0 };

    const elapsed = Date.now() - this.screenShake.startTime;
    const progress = elapsed / this.screenShake.duration;
    const decay = 1 - progress;
    const intensity = this.screenShake.intensity * decay;

    return {
      x: (Math.random() - 0.5) * intensity * 2,
      y: (Math.random() - 0.5) * intensity * 2,
    };
  }

  private getTrailColor(theme: string): string {
    switch (theme) {
      case '1972': return 'rgba(0, 255, 0, ';
      case 'cyber': return 'rgba(0, 255, 255, ';
      case 'fire': return 'rgba(255, 100, 0, ';
      case 'ice': return 'rgba(100, 200, 255, ';
      default: return 'rgba(201, 162, 39, ';
    }
  }

  private getSparkColor(theme: string): string {
    switch (theme) {
      case '1972': return '#00FF00';
      case 'cyber': return '#00FFFF';
      case 'fire': return '#FF4500';
      case 'ice': return '#87CEEB';
      default: return '#C9A227';
    }
  }

  clear(): void {
    this.particles = [];
    this.screenShake = null;
  }
}

// React Native SVG particle renderer component
export const particleStyles = StyleSheet.create({
  particle: {
    position: 'absolute',
    borderRadius: 50,
  },
  scorePopup: {
    position: 'absolute',
    fontSize: 24,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

// Haptic feedback patterns for different events
export const HAPTIC_PATTERNS = {
  paddleHit: 'light',
  wallBounce: 'light',
  scorePoint: 'medium',
  rallyMilestone10: 'medium',
  rallyMilestone25: 'heavy',
  rallyMilestone50: 'heavy',
  gameWin: 'heavy',
  gameLose: 'rigid',
  whisperWallHit: 'heavy',
  achievementUnlock: 'heavy',
} as const;
