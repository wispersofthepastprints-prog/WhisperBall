import Purchases from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY = 'goog_vRwEGCkAowVJZXTwGZQchzSrjbA'; // TODO: replace with production key before release

const REMOVE_ADS_ID = 'remove_ads';
const PREMIUM_PACK_ID = 'premium_pack';

let isInitialized = false;

export async function initPurchases() {
  if (isInitialized) return;
  Purchases.configure({ apiKey: API_KEY });
  isInitialized = true;
}

export async function checkRemoveAdsStatus(): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem('has_removed_ads');
    if (cached === 'true') return true;

    const customerInfo = await Purchases.getCustomerInfo();
    const hasPurchased = 
      customerInfo.entitlements.active['remove_ads'] !== undefined ||
      customerInfo.entitlements.active['premium_pack'] !== undefined;

    if (hasPurchased) {
      await AsyncStorage.setItem('has_removed_ads', 'true');
    }

    return hasPurchased;
  } catch (e) {
    return false;
  }
}

export async function checkPremiumStatus(): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem('has_premium_pack');
    if (cached === 'true') return true;

    const customerInfo = await Purchases.getCustomerInfo();
    const hasPurchased = customerInfo.entitlements.active['premium_pack'] !== undefined;

    if (hasPurchased) {
      await AsyncStorage.setItem('has_premium_pack', 'true');
      await AsyncStorage.setItem('has_removed_ads', 'true');
    }

    return hasPurchased;
  } catch (e) {
    return false;
  }
}

export async function purchaseRemoveAds(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const package_ = offerings.current?.availablePackages.find(
      (p) => p.identifier === REMOVE_ADS_ID || p.product.identifier === REMOVE_ADS_ID
    );

    if (!package_) throw new Error('No remove_ads package found');

    const { customerInfo } = await Purchases.purchasePackage(package_);
    const hasPurchased = 
      customerInfo.entitlements.active['remove_ads'] !== undefined ||
      customerInfo.entitlements.active['premium_pack'] !== undefined;

    if (hasPurchased) {
      await AsyncStorage.setItem('has_removed_ads', 'true');
    }

    return hasPurchased;
  } catch (e: any) {
    if (e.userCancelled) {
      return false;
    }
    throw e;
  }
}

export async function purchasePremiumPack(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const package_ = offerings.current?.availablePackages.find(
      (p) => p.identifier === PREMIUM_PACK_ID || p.product.identifier === PREMIUM_PACK_ID
    );

    if (!package_) throw new Error('No premium_pack package found');

    const { customerInfo } = await Purchases.purchasePackage(package_);
    const hasPurchased = customerInfo.entitlements.active['premium_pack'] !== undefined;

    if (hasPurchased) {
      await AsyncStorage.setItem('has_premium_pack', 'true');
      await AsyncStorage.setItem('has_removed_ads', 'true');
    }

    return hasPurchased;
  } catch (e: any) {
    if (e.userCancelled) {
      return false;
    }
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPremium = customerInfo.entitlements.active['premium_pack'] !== undefined;
    const hasRemoved = customerInfo.entitlements.active['remove_ads'] !== undefined || hasPremium;

    if (hasRemoved) {
      await AsyncStorage.setItem('has_removed_ads', 'true');
    }
    if (hasPremium) {
      await AsyncStorage.setItem('has_premium_pack', 'true');
    }

    return hasRemoved || hasPremium;
  } catch (e) {
    return false;
  }
}
