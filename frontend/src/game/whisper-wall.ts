// whisper-wall.ts - Unique gameplay mechanic for Whisper Ball
// The ball leaves a temporary "whisper wall" trail that affects physics
// When the ball moves fast (> threshold), it leaves behind a temporary wall
// that bounces the ball differently - creating unique gameplay moments

import { SharedValue } from "react-native-reanimated";

export interface WhisperWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  birthTime: number;
  lifetime: number; // ms
  opacity: number;
  color: string;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  lastX: number;
  lastY: number;
}

const WALL_LIFETIME = 3000; // Wall exists for 3 seconds
const WALL_SPEED_THRESHOLD = 4.5; // Only fast balls create walls
const WALL_MIN_DISTANCE = 15; // Minimum distance between wall segments
const WALL_MAX_COUNT = 50; // Maximum walls on screen
const WALL_THICKNESS = 3;

export class WhisperWallSystem {
  walls: WhisperWall[] = [];
  private lastWallPos: { x: number; y: number } | null = null;

  update(deltaTime: number): void {
    const now = Date.now();
    this.walls = this.walls.filter(w => {
      const age = now - w.birthTime;
      if (age > w.lifetime) return false;
      w.opacity = 1 - (age / w.lifetime);
      return true;
    });
  }

  shouldCreateWall(ball: BallState): boolean {
    if (ball.speed < WALL_SPEED_THRESHOLD) return false;
    if (this.walls.length >= WALL_MAX_COUNT) return false;

    if (!this.lastWallPos) {
      this.lastWallPos = { x: ball.x, y: ball.y };
      return false;
    }

    const dx = ball.x - this.lastWallPos.x;
    const dy = ball.y - this.lastWallPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= WALL_MIN_DISTANCE) {
      this.lastWallPos = { x: ball.x, y: ball.y };
      return true;
    }
    return false;
  }

  addWall(x1: number, y1: number, x2: number, y2: number): void {
    this.walls.push({
      x1, y1, x2, y2,
      birthTime: Date.now(),
      lifetime: WALL_LIFETIME,
      opacity: 1,
      color: this.getWallColor(),
    });
  }

  private getWallColor(): string {
    const colors = [
      "rgba(201, 162, 39, ",   // Gold
      "rgba(138, 43, 226, ",  // BlueViolet
      "rgba(0, 255, 255, ",   // Cyan
      "rgba(255, 105, 180, ", // HotPink
      "rgba(50, 205, 50, ",   // LimeGreen
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Check collision between ball and whisper walls
  checkWallCollision(
    ballX: number,
    ballY: number,
    ballRadius: number,
    ballVx: number,
    ballVy: number
  ): { hit: boolean; newVx: number; newVy: number; wallIndex: number } {
    for (let i = 0; i < this.walls.length; i++) {
      const wall = this.walls[i];
      const dist = this.pointToSegmentDistance(ballX, ballY, wall.x1, wall.y1, wall.x2, wall.y2);

      if (dist <= ballRadius + WALL_THICKNESS) {
        // Calculate wall normal
        const wallDx = wall.x2 - wall.x1;
        const wallDy = wall.y2 - wall.y1;
        const wallLen = Math.sqrt(wallDx * wallDx + wallDy * wallDy);

        if (wallLen === 0) continue;

        const nx = -wallDy / wallLen;
        const ny = wallDx / wallLen;

        // Reflect velocity
        const dot = ballVx * nx + ballVy * ny;
        const newVx = ballVx - 2 * dot * nx;
        const newVy = ballVy - 2 * dot * ny;

        // Add slight curve effect
        const curveBoost = 1.15;

        return {
          hit: true,
          newVx: newVx * curveBoost,
          newVy: newVy * curveBoost,
          wallIndex: i,
        };
      }
    }

    return { hit: false, newVx: ballVx, newVy: ballVy, wallIndex: -1 };
  }

  private pointToSegmentDistance(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  clear(): void {
    this.walls = [];
    this.lastWallPos = null;
  }
}

// React Native Reanimated worklet-compatible version
// For use in the game loop
export function createWhisperWallWorklet() {
  'worklet';

  const walls: Array<{
    x1: number; y1: number; x2: number; y2: number;
    birthTime: number; lifetime: number;
  }> = [];

  let lastX = 0;
  let lastY = 0;
  let hasLast = false;

  return {
    update: (now: number) => {
      'worklet';
      for (let i = walls.length - 1; i >= 0; i--) {
        if (now - walls[i].birthTime > walls[i].lifetime) {
          walls.splice(i, 1);
        }
      }
    },

    maybeAddWall: (ballX: number, ballY: number, speed: number, now: number) => {
      'worklet';
      if (speed < 4.5 || walls.length >= 50) return;

      if (!hasLast) {
        lastX = ballX;
        lastY = ballY;
        hasLast = true;
        return;
      }

      const dx = ballX - lastX;
      const dy = ballY - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= 15) {
        walls.push({
          x1: lastX, y1: lastY,
          x2: ballX, y2: ballY,
          birthTime: now,
          lifetime: 3000,
        });
        lastX = ballX;
        lastY = ballY;
      }
    },

    getWalls: () => walls,

    checkCollision: (bx: number, by: number, br: number, bvx: number, bvy: number) => {
      'worklet';
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        // Simplified distance check for worklet
        const midX = (w.x1 + w.x2) / 2;
        const midY = (w.y1 + w.y2) / 2;
        const d = Math.sqrt((bx - midX) ** 2 + (by - midY) ** 2);

        if (d < br + 8) {
          // Reflect
          const wdx = w.x2 - w.x1;
          const wdy = w.y2 - w.y1;
          const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
          if (wlen === 0) continue;

          const nx = -wdy / wlen;
          const ny = wdx / wlen;
          const dot = bvx * nx + bvy * ny;

          return {
            hit: true,
            vx: (bvx - 2 * dot * nx) * 1.15,
            vy: (bvy - 2 * dot * ny) * 1.15,
          };
        }
      }
      return { hit: false, vx: bvx, vy: bvy };
    },

    clear: () => {
      'worklet';
      walls.length = 0;
      hasLast = false;
    },
  };
}
