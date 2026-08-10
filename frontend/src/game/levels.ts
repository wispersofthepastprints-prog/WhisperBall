// 50-level campaign with scaled parameters and 3-star scoring.
// Difficulty scales: ball speed up, paddle shrink, CPU reaction up, obstacles late game.

export type LevelConfig = {
  id: number;
  name: string;
  // Base ball speed multiplier (1 = baseline ~480 px/s)
  ballSpeed: number;
  // Paddle height multiplier (1 = baseline 110 px)
  paddleSize: number;
  // CPU difficulty 0..1: reaction speed and tracking accuracy
  cpuSkill: number;
  // Per-hit speedup factor
  speedUp: number;
  // Target score to win the level (first to N)
  target: number;
  // Star thresholds: minimum opponent score that still gets a star.
  // 3 stars = opponent score <= stars[0], 2 = <= stars[1], 1 = <= stars[2]
  stars: [number, number, number];
  // Number of mid-field obstacles: 0 = none, 1 = center, 2 = upper+lower, 3 = three bars
  obstacleCount: number;
  // Whether obstacles oscillate vertically
  obstacleMoving: boolean;
  // Multi-ball — second ball spawns from level 40+
  multiBall?: boolean;
  // Spin coefficient on paddle hit (0..1)
  spin: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function build(): LevelConfig[] {
  const levels: LevelConfig[] = [];
  for (let i = 1; i <= 50; i++) {
    const t = (i - 1) / 49; // 0..1
    const ballSpeed = lerp(0.8, 2.2, t);
    const paddleSize = lerp(1.4, 0.45, t);
    const cpuSkill = lerp(0.35, 0.97, t);
    const speedUp = lerp(1.025, 1.06, t);
    const target = i <= 10 ? 5 : i <= 30 ? 7 : 9;
    // Obstacle progression: 0 (L1-24), 1 center (L25-34), 2 stacked (L35-44), 3 with motion (L45-50)
    const obstacleCount =
      i < 25 ? 0 : i < 35 ? 1 : i < 45 ? 2 : 3;
    const obstacleMoving = i >= 45;
    const multiBall = i >= 40;
    const spin = lerp(0.15, 0.55, t);
    const stars: [number, number, number] = [
      Math.max(0, Math.floor(target * 0.2)),
      Math.max(1, Math.floor(target * 0.45)),
      Math.max(2, Math.floor(target * 0.7)),
    ];
    levels.push({
      id: i,
      name: `Level ${i}`,
      ballSpeed,
      paddleSize,
      cpuSkill,
      speedUp,
      target,
      stars,
      obstacleCount,
      obstacleMoving,
      multiBall,
      spin,
    });
  }
  return levels;
}

export const LEVELS: LevelConfig[] = build();

export function levelById(id: number): LevelConfig {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))];
}
