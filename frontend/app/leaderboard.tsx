// leaderboard.tsx - Global & Weekly Leaderboard Screen
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/src/utils/supabase";

interface LeaderboardEntry {
  rank: number;
  player_id: string;
  username: string;
  display_name: string;
  total_score: number;
  best_rally: number;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"weekly" | "alltime">("weekly");
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [timeFilter]);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      if (timeFilter === "weekly") {
        const { data, error } = await supabase.rpc("get_weekly_leaderboard", {
          p_limit: 100,
        });
        if (!error && data) {
          setEntries(data);
          // Find my rank
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const me = data.find((e: any) => e.player_id === userData.user!.id);
            if (me) setMyRank(me.rank);
          }
        }
      } else {
        const { data, error } = await supabase
          .from("wb_profiles")
          .select("id, username, display_name, total_score, best_rally")
          .order("total_score", { ascending: false })
          .limit(100);

        if (!error && data) {
          const ranked = data.map((p, i) => ({
            rank: i + 1,
            player_id: p.id,
            username: p.username,
            display_name: p.display_name,
            total_score: p.total_score,
            best_rally: p.best_rally,
          }));
          setEntries(ranked);
        }
      }
    } catch (e) {
      console.error("Leaderboard error:", e);
    } finally {
      setLoading(false);
    }
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#FFD700"; // Gold
    if (rank === 2) return "#C0C0C0"; // Silver
    if (rank === 3) return "#CD7F32"; // Bronze
    return "#8B8B8B";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "trophy";
    if (rank === 2) return "medal";
    if (rank === 3) return "medal-outline";
    return "ranking";
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => (
    <View style={[styles.row, item.rank <= 3 && styles.topRow]}>
      <View style={styles.rankContainer}>
        <Text style={[styles.rankText, { color: getRankColor(item.rank) }]}>
          {item.rank}
        </Text>
        {item.rank <= 3 && (
          <Ionicons
            name={getRankIcon(item.rank) as any}
            size={16}
            color={getRankColor(item.rank)}
          />
        )}
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {item.display_name || item.username || "Anonymous"}
        </Text>
        <Text style={styles.playerSub}>
          Best Rally: {item.best_rally}
        </Text>
      </View>
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>
          {item.total_score.toLocaleString()}
        </Text>
        <Text style={styles.scoreLabel}>pts</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <Pressable
          style={[styles.filterBtn, timeFilter === "weekly" && styles.filterActive]}
          onPress={() => setTimeFilter("weekly")}
        >
          <Text style={[styles.filterText, timeFilter === "weekly" && styles.filterTextActive]}>
            This Week
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, timeFilter === "alltime" && styles.filterActive]}
          onPress={() => setTimeFilter("alltime")}
        >
          <Text style={[styles.filterText, timeFilter === "alltime" && styles.filterTextActive]}>
            All Time
          </Text>
        </Pressable>
      </View>

      {/* My Rank */}
      {myRank && (
        <View style={styles.myRankBanner}>
          <Ionicons name="person-circle" size={20} color="#C9A227" />
          <Text style={styles.myRankText}>
            Your Rank: #{myRank}
          </Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#C9A227" style={styles.loader} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.player_id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
  },
  filterActive: {
    backgroundColor: "#C9A227",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8B8B8B",
  },
  filterTextActive: {
    color: "#0A0A0F",
    fontWeight: "700",
  },
  myRankBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(201,162,39,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,162,39,0.2)",
  },
  myRankText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#C9A227",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    marginBottom: 8,
  },
  topRow: {
    backgroundColor: "rgba(201,162,39,0.08)",
    borderWidth: 1,
    borderColor: "rgba(201,162,39,0.15)",
  },
  rankContainer: {
    width: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rankText: {
    fontSize: 18,
    fontWeight: "800",
    width: 30,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  playerSub: {
    fontSize: 12,
    color: "#8B8B8B",
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#C9A227",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#8B8B8B",
  },
  loader: {
    marginTop: 100,
  },
});
