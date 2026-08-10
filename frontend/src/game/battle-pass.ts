// battle-pass.ts - Whisper Pass integration with RevenueCat
// Season-based battle pass with free and premium tracks

import Purchases, { PurchasesPackage } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/utils/supabase';

const WHISPER_PASS_ID = 'whisper_pass_monthly';
const WHISPER_PASS_YEARLY_ID = 'whisper_pass_yearly';
const CURRENT_SEASON = 1;

export interface BattlePassState {
  tier: number;
  xp: number;
  isPremium: boolean;
  season: number;
  rewardsClaimed: string[];
}

export interface BattlePassReward {
  tier: number;
  type: 'paddle_skin' | 'ball_skin' | 'table_theme' | 'title' | 'coins' | 'xp_boost';
  id: string;
  name: string;
  icon: string;
  isPremiumOnly: boolean;
  xpRequired: number;
}

// XP earning rates
export const XP_RATES = {
  matchPlayed: 50,
  matchWon: 100,
  rally10: 25,
  rally25: 75,
  rally50: 200,
  levelCompleted: 150,
  dailyChallenge: 100,
  tournamentEntry: 200,
};

export async function initBattlePass(): Promise<BattlePassState> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getDefaultBattlePass();

  // Check RevenueCat subscription status
  const customerInfo = await Purchases.getCustomerInfo();
  const isPremium = customerInfo.entitlements.active['whisper_pass'] !== undefined;

  // Get or create battle pass
  const { data, error } = await supabase
    .from('wb_battle_pass')
    .select('*')
    .eq('player_id', user.id)
    .eq('season', CURRENT_SEASON)
    .single();

  if (error || !data) {
    // Create new battle pass
    const newPass: BattlePassState = {
      tier: 0,
      xp: 0,
      isPremium,
      season: CURRENT_SEASON,
      rewardsClaimed: [],
    };

    await supabase.from('wb_battle_pass').insert({
      player_id: user.id,
      season: CURRENT_SEASON,
      tier: 0,
      xp: 0,
      is_premium: isPremium,
      rewards_claimed: [],
    });

    return newPass;
  }

  return {
    tier: data.tier,
    xp: data.xp,
    isPremium: isPremium || data.is_premium,
    season: data.season,
    rewardsClaimed: data.rewards_claimed || [],
  };
}

export async function addXP(amount: number): Promise<{ newTier: number; newXP: number; rewards: any[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { newTier: 0, newXP: 0, rewards: [] };

  const { data, error } = await supabase.rpc('add_battle_pass_xp', {
    p_player_id: user.id,
    p_xp: amount,
  });

  if (error) {
    console.error('Failed to add XP:', error);
    return { newTier: 0, newXP: 0, rewards: [] };
  }

  return data;
}

export async function purchaseWhisperPass(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const package_ = offerings.current?.availablePackages.find(
      (p) => p.identifier === WHISPER_PASS_ID || p.product.identifier === WHISPER_PASS_ID
    );

    if (!package_) {
      // Try yearly
      const yearlyPackage = offerings.current?.availablePackages.find(
        (p) => p.identifier === WHISPER_PASS_YEARLY_ID || p.product.identifier === WHISPER_PASS_YEARLY_ID
      );
      if (!yearlyPackage) throw new Error('No Whisper Pass package found');

      const { customerInfo } = await Purchases.purchasePackage(yearlyPackage);
      return customerInfo.entitlements.active['whisper_pass'] !== undefined;
    }

    const { customerInfo } = await Purchases.purchasePackage(package_);
    return customerInfo.entitlements.active['whisper_pass'] !== undefined;
  } catch (e: any) {
    if (e.userCancelled) return false;
    throw e;
  }
}

export async function checkWhisperPassStatus(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['whisper_pass'] !== undefined;
  } catch {
    return false;
  }
}

export function getDefaultBattlePass(): BattlePassState {
  return {
    tier: 0,
    xp: 0,
    isPremium: false,
    season: CURRENT_SEASON,
    rewardsClaimed: [],
  };
}

// Calculate XP needed for next tier
export function xpForTier(tier: number): number {
  // Exponential curve: each tier needs more XP
  return Math.floor(100 * Math.pow(1.15, tier));
}

// Get all rewards for current season
export async function getBattlePassRewards(): Promise<BattlePassReward[]> {
  const { data, error } = await supabase
    .from('wb_battle_pass_rewards')
    .select('*')
    .eq('season', CURRENT_SEASON)
    .order('tier', { ascending: true });

  if (error || !data) return [];

  return data.map(r => ({
    tier: r.tier,
    type: r.reward_type,
    id: r.reward_id,
    name: r.reward_name,
    icon: r.reward_icon,
    isPremiumOnly: r.is_premium_only,
    xpRequired: r.xp_required,
  }));
}

// Whisper Pass benefits
export const WHISPER_PASS_BENEFITS = [
  'Remove all ads permanently',
  'Unlock all premium battle pass rewards',
  '2x XP earnings',
  'Exclusive "Whisper God" title',
  'Early access to new levels',
  'Priority customer support',
];
