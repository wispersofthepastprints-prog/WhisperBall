import {
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const INTERSTITIAL_UNIT_ID = __DEV__ 
  ? TestIds.INTERSTITIAL 
  : 'ca-app-pub-1508365322358813/9162218888';

const REWARDED_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : 'ca-app-pub-1508365322358813/9457690791';

let interstitial: InterstitialAd | null = null;
let rewarded: RewardedAd | null = null;

export function loadInterstitial() {
  interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });
  interstitial.load();
}

export function showInterstitial(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!interstitial || !interstitial.loaded) {
      resolve(false);
      return;
    }
    interstitial.show();
    interstitial.addAdEventListener('adDismissed', () => {
      loadInterstitial();
      resolve(true);
    });
    interstitial.addAdEventListener('adFailedToShow', () => {
      resolve(false);
    });
  });
}

export function loadRewarded() {
  rewarded = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  });
  rewarded.load();
}

export function showRewarded(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!rewarded || !rewarded.loaded) {
      resolve(false);
      return;
    }
    rewarded.show();
    rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      resolve(true);
    });
    rewarded.addAdEventListener('adDismissed', () => {
      loadRewarded();
    });
    rewarded.addAdEventListener('adFailedToShow', () => {
      resolve(false);
    });
  });
}