import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { LEVELS } from "@/src/game/levels";
import { THEMES, ThemeId } from "@/src/game/theme";
import { getCampaignStars, getSettings } from "@/src/game/persistence";
import { playSfx } from "@/src/game/audio";

export default function Campaign() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [themeId, setThemeId] = useState<ThemeId>("whisper");
  const [stars, setStars] = useState<Record<number, number>>({});

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const s = await getSettings();
        const st = await getCampaignStars();
        if (!mounted) return;
        setThemeId(s.themeId);
        setStars(st);
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const theme = THEMES[themeId] ?? THEMES.whisper;

  // A level is unlocked if the previous level has >=1 star (level 1 always unlocked).
  const isUnlocked = (id: number) => id === 1 || (stars[id - 1] ?? 0) >= 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]} testID="campaign-screen">
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
            testID="campaign-back-button"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brand, { color: theme.textMuted }]}>CAMPAIGN</Text>
            <Text style={[styles.title, { color: theme.text }]}>50 Levels</Text>
          </View>
          <Text style={[styles.progress, { color: theme.accent }]} testID="campaign-progress">
            {Object.values(stars).reduce((a, b) => a + b, 0)} / 150 ★
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {LEVELS.map((lvl) => {
            const unlocked = isUnlocked(lvl.id);
            const earned = stars[lvl.id] ?? 0;
            return (
              <Pressable
                key={lvl.id}
                disabled={!unlocked}
                onPress={() => {
                  playSfx("menu_select", 0.7);
                  router.push(`/game?mode=campaign&level=${lvl.id}` as any);
                }}
                testID={`level-tile-${lvl.id}`}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    borderColor: unlocked
                      ? earned > 0
                        ? theme.accent
                        : "rgba(255,255,255,0.1)"
                      : "rgba(255,255,255,0.04)",
                    backgroundColor: unlocked
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.015)",
                    opacity: !unlocked ? 0.45 : pressed ? 0.82 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tileNum,
                    { color: unlocked ? theme.text : theme.textMuted },
                  ]}
                >
                  {lvl.id}
                </Text>
                <View style={styles.starsRow}>
                  {[0, 1, 2].map((i) => (
                    <Ionicons
                      key={i}
                      name={i < earned ? "star" : "star-outline"}
                      size={10}
                      color={i < earned ? theme.accent : theme.textMuted}
                    />
                  ))}
                </View>
                {!unlocked && (
                  <View style={styles.lock}>
                    <Ionicons name="lock-closed" size={12} color={theme.textMuted} />
                  </View>
                )}
                {lvl.multiBall && unlocked && (
                  <View style={[styles.tag, { borderColor: theme.accent }]}>
                    <Text style={[styles.tagText, { color: theme.accent }]}>2B</Text>
                  </View>
                )}
                {lvl.obstacleCount > 0 && unlocked && (
                  <View style={[styles.tagBR, { borderColor: theme.textMuted }]}>
                    <Text style={[styles.tagText, { color: theme.textMuted }]}>
                      {"|".repeat(lvl.obstacleCount)}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  brand: { fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  progress: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 24,
  },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tileNum: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  lock: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  tag: {
    position: "absolute",
    top: 4,
    left: 4,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagBR: {
    position: "absolute",
    bottom: 4,
    right: 4,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
