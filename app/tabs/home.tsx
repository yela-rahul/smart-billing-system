// app/home.tsx (Updated)
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../firebase/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";
import { getUserId } from "../../utils/authStore";

export default function Home() {
  const router = useRouter();
  const [shopName, setShopName] = useState("Loading...");
  const [today, setToday] = useState("");

  const summary = { revenue: "₹0.00", orders: 0, items: 0 };
  
  const recentBills = [
    { id: "#124", time: "10:45 AM", amount: "₹120", mode: "Cash" },
    { id: "#123", time: "10:30 AM", amount: "₹80", mode: "UPI" },
    { id: "#122", time: "10:10 AM", amount: "₹150", mode: "UPI" },
  ];

  useEffect(() => { loadHeaderData(); }, []);

  const loadHeaderData = async () => {
    try {
      const date = new Date();
      setToday(date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }));
      const uid = await getUserId();
      if (!uid) return;
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setShopName(snap.data().shopName);
    } catch (err) { console.log(err); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#EFF6FF" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.greeting}>Welcome Back,</Text>
            <Text style={styles.shopName}>{shopName}</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/profile")}>
            <View style={styles.profileIconContainer}>
                <Ionicons name="person" size={24} color="#2563EB" />
            </View>
          </TouchableOpacity>
        </View>

        {/* OVERVIEW GRID */}
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <LinearGradient colors={["#2563EB", "#1D4ED8"]} style={styles.revenueCard}>
          <View>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={styles.revenueAmount}>{summary.revenue}</Text>
          </View>
          <View style={styles.iconCircle}>
             <Ionicons name="trending-up" size={24} color="#2563EB" />
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
            <View style={styles.statCard}>
                <View style={[styles.miniIcon, { backgroundColor: "#DBEAFE" }]}>
                    <Ionicons name="receipt" size={20} color="#2563EB" />
                </View>
                <Text style={styles.statValue}>{summary.orders}</Text>
                <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statCard}>
                <View style={[styles.miniIcon, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="cube" size={20} color="#D97706" />
                </View>
                <Text style={styles.statValue}>{summary.items}</Text>
                <Text style={styles.statLabel}>Items Sold</Text>
            </View>
        </View>

        {/* RECENT BILLS */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentBox}>
          {recentBills.map((bill, index) => (
            <View key={index} style={[styles.billRow, index === recentBills.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.billLeft}>
                <View style={styles.billIcon}>
                    <Ionicons name="document-text-outline" size={18} color="#64748B" />
                </View>
                <View>
                    <Text style={styles.billId}>{bill.id}</Text>
                    <Text style={styles.billTime}>{bill.time}</Text>
                </View>
              </View>
              <View style={styles.billRight}>
                 <Text style={styles.billAmount}>{bill.amount}</Text>
                 <Text style={[styles.billMode, bill.mode === "UPI" ? { color: "#2563EB", backgroundColor: "#EFF6FF" } : { color: "#059669", backgroundColor: "#ECFDF5" }]}>{bill.mode}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* BOTTOM SPACER (So content isn't hidden behind the new footer) */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ... Use the styles from the previous response ...
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#EFF6FF" },
  scrollContent: { backgroundColor: "#F8FAFC", minHeight: "100%", paddingBottom: 20 },
  headerSection: { backgroundColor: "#EFF6FF", paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 14, color: "#64748B", fontWeight: "500" },
  shopName: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  dateText: { fontSize: 13, color: "#2563EB", fontWeight: "600", marginTop: 4 },
  profileIconContainer: { backgroundColor: "#FFFFFF", padding: 8, borderRadius: 50, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B", marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  revenueCard: { marginHorizontal: 20, borderRadius: 20, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", elevation: 4, shadowColor: "#2563EB", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 } },
  revenueLabel: { color: "#BFDBFE", fontSize: 14, fontWeight: "500", marginBottom: 6 },
  revenueAmount: { color: "#FFFFFF", fontSize: 32, fontWeight: "800" },
  iconCircle: { backgroundColor: "#FFFFFF", width: 45, height: 45, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  statsRow: { flexDirection: "row", marginHorizontal: 20, marginTop: 16, gap: 16 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#F1F5F9", elevation: 1 },
  miniIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  statValue: { fontSize: 24, fontWeight: "700", color: "#0F172A" },
  statLabel: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  recentHeader: { marginHorizontal: 20, marginTop: 24, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewAll: { fontSize: 14, color: "#2563EB", fontWeight: "600" },
  recentBox: { backgroundColor: "#FFFFFF", marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: "#F1F5F9", overflow: 'hidden' },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  billLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  billIcon: { backgroundColor: "#F8FAFC", padding: 8, borderRadius: 8 },
  billId: { fontSize: 15, fontWeight: "600", color: "#0F172A" },
  billTime: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  billRight: { alignItems: 'flex-end', gap: 4 },
  billAmount: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  billMode: { fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
});