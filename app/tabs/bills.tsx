import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../firebase/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { getUserId } from "../../utils/authStore";

/* ---------------- TYPES ---------------- */
type Bill = {
  id: string;
  billNo?: string;
  grandTotal?: number;
  total?: number; // fallback for old bills
  totalQty?: number;
  paymentMode?: "Cash" | "Online";
  date?: string;
  items?: any[];
};

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const startListening = async () => {
      const uid = await getUserId();
      if (!uid) {
        setLoading(false);
        return;
      }

      // 1. Get reference to bills
      const billsRef = collection(db, "users", uid, "bills");

      // 2. FETCH EVERYTHING (No 'orderBy' here to avoid errors)
      unsubscribe = onSnapshot(billsRef, (snapshot) => {
        const rawList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));

        // 3. SORT MANUALLY IN THE APP (Safest way)
        // This puts the newest bills at the top
        const sortedList = rawList.sort((a: any, b: any) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        });

        setBills(sortedList);
        setLoading(false);
      });
    };

    startListening();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  /* ---------------- FORMAT HELPER ---------------- */
  const formatDate = (isoString?: string) => {
    if (!isoString) return { date: "No Date", time: "--" };
    try {
      const d = new Date(isoString);
      return {
        date: d.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' }),
        time: d.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })
      };
    } catch (e) {
      return { date: "Error", time: "--" };
    }
  };

  /* ---------------- RENDER ITEM ---------------- */
  const renderBill = ({ item }: { item: Bill }) => {
    const { date, time } = formatDate(item.date);
    const isOnline = item.paymentMode === "Online";
    // Handle old bills that might use 'total' instead of 'grandTotal'
    const displayAmount = item.grandTotal || item.total || 0;
    const displayBillNo = item.billNo || "---";

    return (
      <View style={styles.card}>
        {/* LEFT: ICON & INFO */}
        <View style={styles.leftSection}>
          <View style={[styles.iconBox, isOnline ? styles.iconOnline : styles.iconCash]}>
            <Ionicons 
              name={isOnline ? "qr-code" : "cash"} 
              size={20} 
              color={isOnline ? "#2563EB" : "#16A34A"} 
            />
          </View>
          
          <View>
            <Text style={styles.billTitle}>Bill #{displayBillNo}</Text>
            <Text style={styles.meta}>
              {date} • {time}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeCash]}>
                <Text style={[styles.badgeText, isOnline ? styles.textOnline : styles.textCash]}>
                  {item.paymentMode || "Cash"}
                </Text>
              </View>
              {item.totalQty ? (
                <Text style={styles.itemCount}>{item.totalQty} Items</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* RIGHT: AMOUNT */}
        <View style={styles.right}>
          <Text style={styles.amount}>₹{displayAmount}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>History</Text>
          <View style={styles.headerRight}>
             <Text style={styles.totalBills}>{bills.length} Bills</Text>
          </View>
        </View>

        {/* LIST */}
        {loading ? (
          <View style={styles.center}>
             <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : bills.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={64} color="#E2E8F0" />
            <Text style={styles.empty}>No bills found.</Text>
            <Text style={styles.subEmpty}>Create a new bill to see it here.</Text>
          </View>
        ) : (
          <FlatList
            data={bills}
            keyExtractor={(item) => item.id}
            renderItem={renderBill}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  headerRight: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalBills: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  
  listContent: { padding: 16, paddingBottom: 100 },
  
  card: {
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  
  leftSection: { flexDirection: "row", alignItems: "center", gap: 14 },
  
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOnline: { backgroundColor: "#EFF6FF" },
  iconCash: { backgroundColor: "#F0FDF4" },

  billTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  meta: { marginTop: 2, color: "#64748B", fontSize: 12, fontWeight: "500" },
  
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeOnline: { backgroundColor: "#DBEAFE" },
  badgeCash: { backgroundColor: "#DCFCE7" },
  
  badgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  textOnline: { color: "#1E40AF" },
  textCash: { color: "#166534" },
  
  itemCount: { fontSize: 12, color: "#94A3B8" },
  right: { alignItems: "flex-end" },
  amount: { fontSize: 18, fontWeight: "800", color: "#0F172A" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: 16, color: "#94A3B8", fontSize: 18, fontWeight: "600" },
  subEmpty: { marginTop: 8, color: "#CBD5E1", fontSize: 14 },
});