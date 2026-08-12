import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect } from "react";
import { GameScreen } from "@/src/components/GameScreen";
import { initPurchases } from "@/src/game/purchases";

export default function Index() {
  useEffect(() => {
    initPurchases().catch(console.error);
  }, []);

  return <GameScreen />;
}

// Inside your main component, add:
useEffect(() => {
  initPurchases().catch(console.error);
}, []);

import {
  getBestRally,
  getGamesPlayed,
  getSettings,
  getUnlocked1972,
  getWinStreak,
} from "@/src/game/persistence";
import { playSfx, preloadSfx } from "@/src/game/audio";

const { height } = Dimensions.get("window");

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type ModeDef = {
  id: string;
  testID: string;
  route: string;
  title: string;
  subtitle: string;
  icon: IoniconName;
  color: string;
  bgColor: string;
  borderColor: string;
  unlocked: boolean;
  lockedText: string | null;
};

export default function WhisperBallLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Real persisted stats
  const [bestRally, setBestRally] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [unlocked1972, setUnlocked1972] = useState(false);

  // Animation values (kept exactly as designed)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Time-of-day greeting — replaces the hardcoded "Good morning."
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Up late.";
    if (h < 12) return "Good morning.";
    if (h < 17) return "Good afternoon.";
    if (h < 21) return "Good evening.";
    return "Good night.";
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const [s, br, gp, ws, u] = await Promise.all([
          getSettings(),
          getBestRally(),
          getGamesPlayed(),
          getWinStreak(),
          getUnlocked1972(),
        ]);
        if (!mounted) return;
        // s.themeId is read for future theming hooks; design palette stays constant for now.
        void s;
        setBestRally(br);
        setGamesPlayed(gp);
        setWinStreak(ws);
        setUnlocked1972(u);
        preloadSfx();
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animation for the ball accent
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    floatLoop.start();

    // Pulse animation for primary CTA
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [fadeAnim, slideAnim, pulseAnim, floatAnim]);

  const floatInterpolation = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const go = (path: string) => {
    playSfx("menu_select", 0.7);
    router.push(path as any);
  };

  // All four modes are unlocked from the start in our game (Campaign levels
  // unlock progressively inside the Campaign screen). The lock UI is preserved
  // for future progression but currently only applies to the 1972 theme below.
  const gameModes: ModeDef[] = [
    {
      id: "campaign",
      testID: "mode-campaign",
      route: "/campaign",
      title: "Campaign",
      subtitle: "50 levels · 3-star scoring",
      icon: "map",
      color: "#8B5CF6",
      bgColor: "rgba(139, 92, 246, 0.15)",
      borderColor: "rgba(139, 92, 246, 0.3)",
      unlocked: true,
      lockedText: null,
    },
    {
      id: "daily",
      testID: "mode-daily",
      route: "/game?mode=daily",
      title: "Daily Challenge",
      subtitle: "One seed · resets at UTC midnight",
      icon: "calendar",
      color: "#10B981",
      bgColor: "rgba(16, 185, 129, 0.15)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      unlocked: true,
      lockedText: null,
    },
    {
      id: "local",
      testID: "mode-local2p",
      route: "/game?mode=local2p",
      title: "Local 2P",
      subtitle: "Two thumbs · one phone",
      icon: "people",
      color: "#F59E0B",
      bgColor: "rgba(245, 158, 11, 0.15)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      unlocked: true,
      lockedText: null,
    },
  ];

  // Progress hint targets the only real progression in the game: the 1972 theme.
  const hitsToUnlock = Math.max(0, 50 - bestRally);
  const progressHint = unlocked1972
    ? "1972 theme unlocked. Try it in Settings."
    : bestRally === 0
      ? "Reach a 50-hit rally to unlock the 1972 theme."
      : null;

  return (
    <View style={styles.container} testID="main-menu-screen">
      {/* Animated Background Elements */}
      <View style={styles.bgAccent}>
        <Animated.View
          style={[
            styles.floatingOrb,
            { transform: [{ translateY: floatInterpolation }] },
          ]}
        />
      </View>

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>BETA</Text>
          </View>
          <Pressable
            onPress={() => go("/settings")}
            testID="mode-settings"
            hitSlop={10}
            style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="settings-outline" size={22} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.title} testID="app-title">
            Whisper Ball
          </Text>
          <Text style={styles.subtitle}>A modern table-ball game</Text>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* Stats Row */}
        <Animated.View
          style={[
            styles.statsContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.statCard}>
            <Text style={styles.statValue} testID="best-rally-value">
              {bestRally}
            </Text>
            <Text style={styles.statLabel}>BEST RALLY</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{gamesPlayed}</Text>
            <Text style={styles.statLabel}>MATCHES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{winStreak}</Text>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
        </Animated.View>

        {/* Primary CTA — Quick Match */}
        <Animated.View
          style={[
            styles.ctaContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              testID="mode-quick"
              onPress={() => go("/game?mode=quick")}
              style={({ pressed }) => [
                styles.playButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="flash" size={24} color="#0A0A0A" />
              <Text style={styles.playButtonText}>PLAY NOW</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Game Modes */}
        <View style={styles.modesSection}>
          <Text style={styles.sectionTitle}>GAME MODES</Text>

          {gameModes.map((mode, index) => (
            <Animated.View
              key={mode.id}
              style={[
                styles.modeCard,
                {
                  backgroundColor: mode.bgColor,
                  borderColor: mode.borderColor,
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 30],
                        outputRange: [0, 30 + index * 10],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Pressable
                testID={mode.testID}
                disabled={!mode.unlocked}
                onPress={() => mode.unlocked && go(mode.route)}
                style={({ pressed }) => [
                  styles.modeCardInner,
                  { opacity: mode.unlocked && pressed ? 0.7 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.modeIcon,
                    { backgroundColor: mode.color + "25" },
                  ]}
                >
                  <Ionicons name={mode.icon} size={22} color={mode.color} />
                </View>

                <View style={styles.modeInfo}>
                  <Text style={styles.modeTitle}>{mode.title}</Text>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                </View>

                {mode.unlocked ? (
                  <View style={styles.modeArrow}>
                    <Ionicons name="chevron-forward" size={20} color={mode.color} />
                  </View>
                ) : (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
                    <Text style={styles.lockText}>{mode.lockedText}</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Progress Hint — 1972 theme unlock */}
        {(progressHint || (!unlocked1972 && bestRally > 0)) && (
          <View style={styles.progressHint}>
            <Ionicons name="trophy-outline" size={16} color="#C9A227" />
            <Text style={styles.progressHintText}>
              {progressHint ? (
                progressHint
              ) : (
                <>
                  You&apos;re{" "}
                  <Text style={styles.progressBold}>{hitsToUnlock} hits</Text>{" "}
                  away from unlocking the 1972 theme
                </>
              )}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Brand */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}
        pointerEvents="none"
      >
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>Whisper Ball</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  bgAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  floatingOrb: {
    position: "absolute",
    top: height * 0.15,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(201, 162, 39, 0.08)",
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(201, 162, 39, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.3)",
  },
  badgeText: {
    color: "#C9A227",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  titleBlock: {
    gap: 4,
  },
  greeting: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    color: "#F8F6F0",
    letterSpacing: -1,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "400",
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F8F6F0",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1.2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  ctaContainer: {
    alignItems: "center",
    marginTop: 28,
    marginBottom: 8,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#C9A227",
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 16,
    shadowColor: "#C9A227",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  playButtonText: {
    color: "#0A0A0A",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modesSection: {
    marginTop: 32,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  modeCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modeInfo: {
    flex: 1,
    gap: 2,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8F6F0",
  },
  modeSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "400",
  },
  modeArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  progressHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(201, 162, 39, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.15)",
  },
  progressHintText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  progressBold: {
    color: "#C9A227",
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 14,
    backgroundColor: "rgba(10,10,10,0.9)",
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C9A227",
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 2,
  },
});
