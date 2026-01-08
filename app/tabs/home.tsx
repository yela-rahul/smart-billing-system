import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { getUserId } from "../../utils/authStore";
import { db } from "../../firebase/firebaseConfig";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";

const { width } = Dimensions.get("window");

/* ---------------- TYPES ---------------- */
type BillItem = {
  id: string;
  billNo: string;
  grandTotal: number;
  paymentMode: string;
  date: string;
  totalQty: number;
};

type DashboardStats = {
  totalRevenue: number;
  totalOrders: number;
  itemsSold: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("Shop Owner");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    itemsSold: 0,
  });
  const [recentBills, setRecentBills] = useState<BillItem[]>([]);

  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  /* ---------------- FETCH DATA ---------------- */
  const fetchDashboardData = async () => {
    try {
      const uid = await getUserId();
      if (!uid) return;

      // 1. Get Shop Name
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserName(userData.shopName || userData.name || "Shop Owner");
      }

      // 2. Get Bills
      const q = query(collection(db, "users", uid, "bills"), orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);

      const todayString = new Date().toDateString();
      
      let revenue = 0;
      let orders = 0;
      let items = 0;
      
      const allBills: BillItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const billDate = new Date(data.date).toDateString();
        
        allBills.push({ id: doc.id, ...data } as BillItem);

        // Calculate Today's Stats
        if (billDate === todayString) {
          revenue += Number(data.grandTotal || 0);
          orders += 1;
          items += Number(data.totalQty || 0);
        }
      });

      // 3. Update State
      setStats({
        totalRevenue: revenue,
        totalOrders: orders,
        itemsSold: items,
      });
      
      setRecentBills(allBills.slice(0, 3));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <View style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* Header (Now matches background color) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome Back,</Text>
          <Text style={styles.shopName}>{userName.toUpperCase()}</Text>
          <Text style={styles.dateText}>{todayDate}</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push("/profile")}>
          <Ionicons name="person" size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Today's Overview</Text>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <View>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={styles.revenueAmount}>
              ₹{stats.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.trendIcon}>
            <Ionicons name="trending-up" size={24} color="#2563EB" />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.iconBox, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="receipt" size={24} color="#2563EB" />
            </View>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="inventory" size={24} color="#D97706" />
            </View>
            <Text style={styles.statValue}>{stats.itemsSold}</Text>
            <Text style={styles.statLabel}>Items Sold</Text>
          </View>
        </View>

        {/* Recent Bills */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          <TouchableOpacity onPress={() => router.push("/tabs/bills")}>
            <Text style={styles.viewAllBtn}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentBills.length === 0 ? (
          <Text style={styles.noBillsText}>No orders found.</Text>
        ) : (
          recentBills.map((bill) => (
            <View key={bill.id} style={styles.billCard}>
              <View style={styles.billIcon}>
                <Ionicons name="document-text-outline" size={24} color="#64748B" />
              </View>
              <View style={styles.billInfo}>
                <Text style={styles.billNo}>Bill #{bill.billNo}</Text>
                <Text style={styles.billTime}>
                  {new Date(bill.date).toLocaleDateString("en-IN", {day:'2-digit', month:'short'})} 
                  {', '}
                  {new Date(bill.date).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.billAmount}>₹{bill.grandTotal}</Text>
                <View style={[styles.badge, bill.paymentMode === "Online" ? styles.badgeBlue : styles.badgeGreen]}>
                  <Text style={[styles.badgeText, bill.paymentMode === "Online" ? styles.textBlue : styles.textGreen]}>
                    {bill.paymentMode}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Removed the duplicate FAB here */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Main background color (Uniform Light Blue-Grey)
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  
  // Header matches the background now
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingBottom: 16,
    backgroundColor: "#F8FAFC" // Changed from #fff to match body
  },
  
  welcomeText: { fontSize: 16, color: "#64748B", fontWeight: "600" },
  shopName: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  dateText: { fontSize: 14, color: "#2563EB", fontWeight: "600", marginTop: 4 },
  
  profileBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", // White button on grey bg
    justifyContent: "center", alignItems: "center", 
    borderWidth: 1, borderColor: "#E2E8F0",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4
  },
  
  scrollContent: { padding: 24, paddingTop: 8, paddingBottom: 100 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#0F172A", marginBottom: 16 },
  
  revenueCard: {
    backgroundColor: "#2563EB", borderRadius: 24, padding: 24, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center", marginBottom: 24,
    shadowColor: "#2563EB", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8
  },
  revenueLabel: { color: "#BFDBFE", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  revenueAmount: { color: "#fff", fontSize: 36, fontWeight: "800" },
  trendIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center"
  },
  
  statsRow: { flexDirection: "row", gap: 16, marginBottom: 32 },
  statCard: {
    flex: 1, backgroundColor: "#fff", padding: 20, borderRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  statValue: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  statLabel: { fontSize: 14, color: "#64748B", fontWeight: "600" },

  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  viewAllBtn: { fontSize: 14, fontWeight: "700", color: "#2563EB" },
  noBillsText: { color: "#94A3B8", fontStyle: "italic" },
  
  billCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    padding: 16, borderRadius: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  billIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: "#F8FAFC",
    justifyContent: "center", alignItems: "center", marginRight: 16
  },
  billInfo: { flex: 1 },
  billNo: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  billTime: { fontSize: 12, color: "#64748B", marginTop: 4 },
  billAmount: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  badgeBlue: { backgroundColor: "#DBEAFE" },
  badgeGreen: { backgroundColor: "#DCFCE7" },
  badgeText: { fontSize: 10, fontWeight: "700" },
  textBlue: { color: "#1E40AF" },
  textGreen: { color: "#166534" },
});