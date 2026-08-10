// achievements.ts - Achievement tracking and unlocking system
import { supabase } from "@/src/utils/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  unlockedAt?: string;
}

export const ACHIEVEMENT_DEFINITIONS: Record<string, Omit<Achievement, 'unlocked' | 'unlockedAt'>> = {
  first_win: {
    name: 'First Victory',
    description: 'Win your first match',
    icon: 'trophy',
    rarity: 'common',
  },
  rally_10: {
    name: 'Rally Master',
    description: 'Hit a 10-ball rally',
    icon: 'zap',
    rarity: 'common',
  },
  rally_25: {
    name: 'Rally Legend',
    description: 'Hit a 25-ball rally',
    icon: 'flame',
    rarity: 'rare',
  },
  rally_50: {
    name: 'Whisper God',
    description: 'Hit a 50-ball rally',
    icon: 'star',
    rarity: 'epic',
  },
  level_10: {
    name: 'Campaign Starter',
    description: 'Complete level 10',
    icon: 'map',
    rarity: 'common',
  },
  level_25: {
    name: 'Campaign Warrior',
    description: 'Complete level 25',
    icon: 'shield',
    rarity: 'rare',
  },
  level_50: {
    name: 'Campaign Champion',
    description: 'Complete all 50 levels',
    icon: 'crown',
    rarity: 'legendary',
  },
  daily_7: {
    name: 'Week Warrior',
    description: 'Complete 7 daily challenges',
    icon: 'calendar',
    rarity: 'rare',
  },
  daily_30: {
    name: 'Month Master',
    description: 'Complete 30 daily challenges',
    icon: 'calendar-number',
    rarity: 'epic',
  },
  streak_5: {
    name: 'On Fire',
    description: 'Win 5 matches in a row',
    icon: 'flame',
    rarity: 'rare',
  },
  streak_10: {
    name: 'Unstoppable',
    description: 'Win 10 matches in a row',
    icon: 'lightning',
    rarity: 'legendary',
  },
  whisper_wall: {
    name: 'Phantom Bounce',
    description: 'Bounce off a Whisper Wall',
    icon: 'ghost',
    rarity: 'epic',
  },
  perfect_game: {
    name: 'Flawless',
    description: 'Win without losing a point',
    icon: 'diamond',
    rarity: 'legendary',
  },
};

// Check and unlock achievement
export async function unlockAchievement(key: string): Promise<boolean> {
  const def = ACHIEVEMENT_DEFINITIONS[key];
  if (!def) return false;

  // Check if already unlocked locally
  const cached = await AsyncStorage.getItem(`achievement_${key}`);
  if (cached === 'true') return false;

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      // Offline: cache for later sync
      await AsyncStorage.setItem(`achievement_${key}`, 'pending');
      return true;
    }

    // Call RPC to check and unlock
    const { data, error } = await supabase.rpc('check_achievements', {
      p_player_id: userData.user.id,
      p_achievement_key: key,
    });

    if (!error && data) {
      await AsyncStorage.setItem(`achievement_${key}`, 'true');

      // Show toast notification
      showAchievementToast(def);

      return true;
    }
  } catch (e) {
    console.error('Achievement unlock failed:', e);
  }

  return false;
}

// Get all achievements with unlock status
export async function getAllAchievements(): Promise<Achievement[]> {
  const { data: userData } = await supabase.auth.getUser();

  let unlockedKeys: string[] = [];

  if (userData.user) {
    const { data } = await supabase
      .from('wb_achievements')
      .select('achievement_key')
      .eq('player_id', userData.user.id);

    unlockedKeys = data?.map(a => a.achievement_key) || [];
  }

  // Also check local cache
  const localKeys = await AsyncStorage.multiGet(
    Object.keys(ACHIEVEMENT_DEFINITIONS).map(k => `achievement_${k}`)
  );

  const localUnlocked = localKeys
    .filter(([_, val]) => val === 'true' || val === 'pending')
    .map(([key, _]) => key.replace('achievement_', ''));

  const allUnlocked = new Set([...unlockedKeys, ...localUnlocked]);

  return Object.entries(ACHIEVEMENT_DEFINITIONS).map(([key, def]) => ({
    key,
    ...def,
    unlocked: allUnlocked.has(key),
    unlockedAt: allUnlocked.has(key) ? new Date().toISOString() : undefined,
  }));
}

// Sync offline achievements
export async function syncOfflineAchievements(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const localKeys = await AsyncStorage.multiGet(
    Object.keys(ACHIEVEMENT_DEFINITIONS).map(k => `achievement_${k}`)
  );

  for (const [key, val] of localKeys) {
    if (val === 'pending') {
      const achievementKey = key.replace('achievement_', '');
      await supabase.rpc('check_achievements', {
        p_player_id: userData.user.id,
        p_achievement_key: achievementKey,
      });
      await AsyncStorage.setItem(key, 'true');
    }
  }
}

// Achievement toast notification
function showAchievementToast(achievement: typeof ACHIEVEMENT_DEFINITIONS[string]) {
  // This would integrate with your toast system
  // For now, just log it
  console.log(`🏆 Achievement Unlocked: ${achievement.name} (${achievement.rarity})`);
}

// Rarity colors for UI
export const RARITY_COLORS = {
  common: '#8B8B8B',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#FFD700',
};

export const RARITY_BG = {
  common: 'rgba(139,139,139,0.1)',
  rare: 'rgba(59,130,246,0.1)',
  epic: 'rgba(168,85,247,0.1)',
  legendary: 'rgba(255,215,0,0.1)',
};
