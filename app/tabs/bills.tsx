import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../firebase/firebaseConfig";
import { getUserId } from "../../utils/authStore";

/* ---------------- TYPES ---------------- */
type Bill = {
  id: string;
  billNo?: string;
  grandTotal?: number;
  total?: number;
  totalQty?: number;
  paymentMode?: "Cash" | "Online";
  date?: string;
  items?: any[];
};

type ListItem =
  | { type: "header"; label: string }
  | { type: "bill"; data: Bill };

/* ---------------- CONSTANTS ---------------- */
const PAGE_SIZE = 20;

/* ---------------- HELPERS ---------------- */
const getSectionLabel = (isoString?: string): string => {
  if (!isoString) return "Unknown Date";
  const billDate = new Date(isoString);
  if (isNaN(billDate.getTime())) return "Unknown Date";

  const today      = new Date();
  const yesterday  = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (billDate.toDateString() === today.toDateString())     return "Today";
  if (billDate.toDateString() === yesterday.toDateString()) return "Yesterday";

  return billDate.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const getTime = (isoString?: string): string => {
  if (!isoString) return "--";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const groupBillsByDate = (bills: Bill[]): ListItem[] => {
  const result: ListItem[] = [];
  let lastLabel = "";
  for (const bill of bills) {
    const label = getSectionLabel(bill.date);
    if (label !== lastLabel) {
      result.push({ type: "header", label });
      lastLabel = label;
    }
    result.push({ type: "bill", data: bill });
  }
  return result;
};

/* ================================================================
   MAIN COMPONENT
================================================================ */
export default function Bills() {
  const [bills, setBills]             = useState<Bill[]>([]);
  const [listItems, setListItems]     = useState<ListItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [lastDoc, setLastDoc]         = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [refreshing, setRefreshing]   = useState(false);

  /* ── Initial load: today + yesterday ── */
  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      const uid = await getUserId();
      if (!uid) return;

      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, "users", uid, "bills"),
        where("date", ">=", yesterdayStart.toISOString()),
        orderBy("date", "desc"),
        limit(PAGE_SIZE)
      );

      const snap = await getDocs(q);
      const fetched: Bill[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      setBills(fetched);
      setListItems(groupBillsByDate(fetched));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error("Bills load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Load more: triggered when user scrolls to bottom ── */
  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    try {
      setLoadingMore(true);
      const uid = await getUserId();
      if (!uid) return;

      const q = query(
        collection(db, "users", uid, "bills"),
        orderBy("date", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snap = await getDocs(q);
      const fetched: Bill[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      const updated = [...bills, ...fetched];
      setBills(updated);
      setListItems(groupBillsByDate(updated));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error("Bills load more error:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Reload fresh every time the Bills tab is focused
  // This ensures a newly saved bill always appears immediately
  useFocusEffect(
    useCallback(() => {
      // Reset pagination state then load fresh
      setBills([]);
      setListItems([]);
      setLastDoc(null);
      setHasMore(true);
      loadInitial();
    }, [])
  );

  /* ── Pull to refresh ── */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setBills([]);
    setListItems([]);
    setLastDoc(null);
    setHasMore(true);
    await loadInitial();
    setRefreshing(false);
  }, []);

  const billCount = listItems.filter((i) => i.type === "bill").length;

  /* ── Date section header ── */
  const renderHeader = (label: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );

  /* ── Bill card ── */
  const renderBillCard = (bill: Bill) => {
    const isOnline      = bill.paymentMode === "Online";
    const displayAmount = bill.grandTotal ?? bill.total ?? 0;
    const displayBillNo = bill.billNo || "---";
    const time          = getTime(bill.date);

    return (
      <View style={styles.card}>
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
            <Text style={styles.meta}>{time}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeCash]}>
                <Text style={[styles.badgeText, isOnline ? styles.textOnline : styles.textCash]}>
                  {bill.paymentMode || "Cash"}
                </Text>
              </View>
              {bill.totalQty ? (
                <Text style={styles.itemCount}>{bill.totalQty} items</Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.amount}>
            ₹{Number(displayAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "header") return renderHeader(item.label);
    return renderBillCard(item.data);
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={styles.footerText}>Loading older bills...</Text>
      </View>
    );
  };

  const renderLoadMoreButton = () => {
    if (!hasMore || loadingMore) return null;
    return (
      <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
        <Ionicons name="chevron-down" size={16} color="#2563EB" />
        <Text style={styles.loadMoreText}>Load older bills</Text>
      </TouchableOpacity>
    );
  };

  /* ================================================================
     UI
  ================================================================ */
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bills</Text>
          <View style={styles.headerRight}>
            <Text style={styles.totalBills}>{billCount} shown</Text>
          </View>
        </View>

        {/* CONTENT */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading bills...</Text>
          </View>
        ) : listItems.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="receipt-outline" size={64} color="#E2E8F0" />
            <Text style={styles.empty}>No bills found.</Text>
            <Text style={styles.subEmpty}>Create a new bill to see it here.</Text>
          </View>
        ) : (
          <FlatList
            data={listItems}
            keyExtractor={(item, index) =>
              item.type === "header"
                ? `header-${item.label}`
                : `bill-${item.data.id}-${index}`
            }
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#2563EB"]}
                tintColor="#2563EB"
              />
            }
            ListFooterComponent={
              <>
                {renderLoadMoreButton()}
                {renderFooter()}
              </>
            }
          />
        )}

      </View>
    </SafeAreaView>
  );
}

/* ================================================================
   STYLES
================================================================ */
const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1 },

  header: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    paddingHorizontal: 20,
    paddingVertical:   16,
    backgroundColor:   "#fff",
    borderBottomWidth: 1,
    borderColor:       "#E2E8F0",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  headerRight: {
    backgroundColor:   "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
  },
  totalBills: { fontSize: 12, fontWeight: "600", color: "#64748B" },

  listContent: { padding: 16, paddingBottom: 120 },

  /* Date section header */
  sectionHeader: {
    flexDirection: "row",
    alignItems:    "center",
    marginTop:     20,
    marginBottom:  10,
  },
  sectionLabel: {
    fontSize:    13,
    fontWeight:  "700",
    color:       "#2563EB",
    marginRight: 10,
    minWidth:    80,
  },
  sectionLine: {
    flex:            1,
    height:          1,
    backgroundColor: "#E2E8F0",
  },

  /* Bill card */
  card: {
    backgroundColor: "#fff",
    marginBottom:    10,
    padding:         16,
    borderRadius:    16,
    flexDirection:   "row",
    justifyContent:  "space-between",
    alignItems:      "center",
    shadowColor:     "#64748B",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
    borderWidth:     1,
    borderColor:     "#F1F5F9",
  },
  leftSection: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBox: {
    width:          44,
    height:         44,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
  },
  iconOnline: { backgroundColor: "#EFF6FF" },
  iconCash:   { backgroundColor: "#F0FDF4" },

  billTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  meta:      { marginTop: 2, color: "#64748B", fontSize: 12, fontWeight: "500" },

  badgeRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  badge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeOnline: { backgroundColor: "#DBEAFE" },
  badgeCash:   { backgroundColor: "#DCFCE7" },
  badgeText:   { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  textOnline:  { color: "#1E40AF" },
  textCash:    { color: "#166534" },
  itemCount:   { fontSize: 12, color: "#94A3B8" },

  right:  { alignItems: "flex-end" },
  amount: { fontSize: 18, fontWeight: "800", color: "#0F172A" },

  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14, fontWeight: "500" },
  empty:       { marginTop: 16, color: "#94A3B8", fontSize: 18, fontWeight: "600" },
  subEmpty:    { marginTop: 8, color: "#CBD5E1", fontSize: 14 },

  /* Pagination */
  footerLoader: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 16,
    gap:             8,
  },
  footerText: { color: "#64748B", fontSize: 13 },

  loadMoreBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             6,
    paddingVertical: 14,
    marginTop:       8,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     "#DBEAFE",
    backgroundColor: "#EFF6FF",
  },
  loadMoreText: { color: "#2563EB", fontSize: 14, fontWeight: "600" },
});