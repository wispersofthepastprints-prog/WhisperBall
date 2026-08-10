import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { THEMES, ThemeId } from "@/src/game/theme";
import {
  getSettings,
  setSetting,
  getUnlocked1972,
  getBestRally,
} from "@/src/game/persistence";
import { playSfx, setSoundEnabled } from "@/src/game/audio";
import {
  purchaseRemoveAds,
  purchasePremiumPack,
  restorePurchases,
  checkRemoveAdsStatus,
  checkPremiumStatus,
} from "@/src/game/purchases";

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [themeId, setThemeId] = useState<ThemeId>("whisper");
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [unlocked1972, setUnlocked1972] = useState(false);
  const [bestRally, setBestRally] = useState(0);
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [premiumActive, setPremiumActive] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const s = await getSettings();
        const u = await getUnlocked1972();
        const br = await getBestRally();
        const removed = await checkRemoveAdsStatus();
        const premium = await checkPremiumStatus();
        if (!mounted) return;
        setThemeId(s.themeId);
        setSound(s.sound);
        setHaptics(s.haptics);
        setUnlocked1972(u || premium); // premium auto-unlocks 1972
        setBestRally(br);
        setAdsRemoved(removed);
        setPremiumActive(premium);
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const theme = THEMES[themeId] ?? THEMES.whisper;

  const pickTheme = async (id: ThemeId) => {
    if (id === "1972" && !unlocked1972) return;
    setThemeId(id);
    await setSetting("themeId", id);
  };

  const toggleSound = async (v: boolean) => {
    setSound(v);
    setSoundEnabled(v);
    await setSetting("sound", v);
    if (v) playSfx("score", 0.4);
  };

  const toggleHaptics = async (v: boolean) => {
    setHaptics(v);
    await setSetting("haptics", v);
  };

  const handlePurchase = async () => {
    setPurchaseLoading(true);
    try {
      const success = await purchaseRemoveAds();
      if (success) {
        setAdsRemoved(true);
        playSfx("win", 0.9);
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handlePremium = async () => {
    setPurchaseLoading(true);
    try {
      const success = await purchasePremiumPack();
      if (success) {
        setAdsRemoved(true);
        setPremiumActive(true);
        setUnlocked1972(true);
        playSfx("win", 0.9);
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleRestore = async () => {
    setPurchaseLoading(true);
    try {
      const success = await restorePurchases();
      if (success) {
        setAdsRemoved(true);
        playSfx("win", 0.9);
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]} testID="settings-screen">
      <LinearGradient
        colors={[theme.bgGradientTop, theme.bgGradientBottom]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              playSfx("menu_back", 0.7);
              router.back();
            }}
            style={styles.backBtn}
            testID="settings-back-button"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>THEME</Text>
            <View style={styles.themeRow}>
              <ThemeCard
                theme={theme}
                active={themeId === "whisper"}
                name="Whisper"
                desc="Obsidian · ivory · gold"
                onPress={() => pickTheme("whisper")}
                testID="theme-whisper"
              />
              <ThemeCard
                theme={theme}
                active={themeId === "1972"}
                locked={!unlocked1972}
                name="1972"
                desc={
                  unlocked1972
                    ? "Phosphor green · CRT"
                    : `Locked · 50-hit rally (best ${bestRally})`
                }
                onPress={() => pickTheme("1972")}
                testID="theme-1972"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>FEEDBACK</Text>
            <Row label="Sound" value={sound} onValueChange={toggleSound} theme={theme} testID="setting-sound" />
            <Row label="Haptics" value={haptics} onValueChange={toggleHaptics} theme={theme} testID="setting-haptics" />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PREMIUM</Text>
            {premiumActive ? (
              <View style={[styles.premiumRow, { backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }]}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={[styles.premiumText, { color: "#10B981" }]}>
                  Premium Pack Active — All Perks Unlocked
                </Text>
              </View>
            ) : adsRemoved ? (
              <View style={[styles.premiumRow, { backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)" }]}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={[styles.premiumText, { color: "#10B981" }]}>
                  Ads Removed — Upgrade to Premium for $6.99
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={handlePremium}
                  disabled={purchaseLoading}
                  style={({ pressed }) => [
                    styles.premiumBtn,
                    {
                      backgroundColor: theme.accent,
                      opacity: pressed ? 0.85 : purchaseLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  <Ionicons name="diamond" size={16} color="#0A0A0F" />
                  <Text style={styles.premiumBtnText}>
                    {purchaseLoading ? "Processing..." : "Premium Pack — $6.99"}
                  </Text>
                </Pressable>
                <Text style={[styles.premiumSub, { color: theme.textMuted }]}>
                  Remove ads + instant 1972 theme + unlimited daily retries
                </Text>
                <Pressable
                  onPress={handlePurchase}
                  disabled={purchaseLoading}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    {
                      borderColor: "rgba(255,255,255,0.1)",
                      opacity: pressed ? 0.7 : purchaseLoading ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                    {purchaseLoading ? "Processing..." : "Remove Ads Only — $4.99"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleRestore}
                  disabled={purchaseLoading}
                  style={({ pressed }) => [
                    styles.restoreBtn,
                    { opacity: pressed ? 0.7 : purchaseLoading ? 0.5 : 1 },
                  ]}
                >
                  <Text style={[styles.restoreText, { color: theme.textMuted }]}>
                    Restore Purchases
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ABOUT</Text>
            <Text style={[styles.aboutLine, { color: theme.text }]}>Whisper Ball</Text>
            <Text style={[styles.aboutSub, { color: theme.textMuted }]}>
              by Wispers of the Past · v1.0.0 (beta)
            </Text>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  "mailto:wispersofthepastprints@gmail.com?subject=Whisper%20Ball%20feedback",
                ).catch(() => {})
              }
              testID="settings-contact-email"
              hitSlop={8}
              style={({ pressed }) => [styles.contactRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="mail-outline" size={13} color={theme.accent} />
              <Text style={[styles.contactText, { color: theme.accent }]}>
                wispersofthepastprints@gmail.com
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                Linking.openURL(
                  "https://wispersofthepastprints-prog.github.io/WhisperBall/privacy-policy.html",
                ).catch(() => {})
              }
              testID="settings-privacy-link"
              hitSlop={8}
              style={({ pressed }) => [styles.contactRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="shield-checkmark-outline" size={13} color={theme.accent} />
              <Text style={[styles.contactText, { color: theme.accent }]}>
                Privacy Policy
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                Linking.openURL(
                  "https://wispersofthepastprints-prog.github.io/WhisperBall/terms-of-service.html",
                ).catch(() => {})
              }
              testID="settings-terms-link"
              hitSlop={8}
              style={({ pressed }) => [styles.contactRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="document-text-outline" size={13} color={theme.accent} />
              <Text style={[styles.contactText, { color: theme.accent }]}>
                Terms of Service
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  onValueChange,
  theme,
  testID,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  theme: (typeof THEMES)[ThemeId];
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "rgba(255,255,255,0.12)", true: theme.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

function ThemeCard({
  theme,
  active,
  locked,
  name,
  desc,
  onPress,
  testID,
}: {
  theme: (typeof THEMES)[ThemeId];
  active: boolean;
  locked?: boolean;
  name: string;
  desc: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      testID={testID}
      style={({ pressed }) => [
        styles.themeCard,
        {
          borderColor: active ? theme.accent : "rgba(255,255,255,0.08)",
          backgroundColor: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
          opacity: locked ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.themeName, { color: theme.text }]}>{name}</Text>
      <Text style={[styles.themeDesc, { color: theme.textMuted }]}>{desc}</Text>
      {locked && (
        <Ionicons
          name="lock-closed"
          size={14}
          color={theme.textMuted}
          style={styles.themeLock}
        />
      )}
      {active && !locked && (
        <Ionicons
          name="checkmark-circle"
          size={16}
          color={theme.accent}
          style={styles.themeLock}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  body: { gap: 18, maxWidth: 720 },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: 6,
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
  },
  themeCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderRadius: 12,
    position: "relative",
    minHeight: 70,
  },
  themeName: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  themeDesc: { fontSize: 11, fontWeight: "500" },
  themeLock: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.025)",
    minHeight: 48,
  },
  rowLabel: { fontSize: 14, fontWeight: "600" },
  aboutLine: { fontSize: 15, fontWeight: "700" },
  aboutSub: { fontSize: 11, fontWeight: "500" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  contactText: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  premiumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  premiumText: {
    fontSize: 14,
    fontWeight: "700",
  },
  premiumBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#C9A227",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  premiumBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0A0A0F",
    letterSpacing: 0.3,
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  restoreText: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  premiumSub: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 4,
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});