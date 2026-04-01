import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { getUserId } from "../../utils/authStore";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";

const { width } = Dimensions.get("window");
const SCREEN_PADDING = 20;
const CHART_W = width - SCREEN_PADDING * 2;

/* ============================================================
   TYPES
============================================================ */
type CartItem = { id: string; name: string; price: number; quantity: number };
type Bill = {
  id: string;
  billNo: string;
  grandTotal: number;
  totalQty: number;
  paymentMode: "Cash" | "Online";
  date: string;
  items: CartItem[];
};
type FilterType = "Today" | "This Week" | "This Month";

/* ============================================================
   HELPERS
============================================================ */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Full 24-hour labels — used for DATA indexing only, NOT as chart labels directly
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
});

const getStartOf = (filter: FilterType): Date => {
  const now = new Date();
  if (filter === "Today")
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "This Week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.getFullYear(), now.getMonth(), diff);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");

/* ============================================================
   CHART CONFIG BASE
============================================================ */
const CHART_CONFIG = {
  backgroundGradientFrom: "#fff",
  backgroundGradientTo: "#fff",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  propsForBackgroundLines: { strokeDasharray: "", stroke: "#F1F5F9" },
  paddingRight: 35,
};

/* ============================================================
   MAIN COMPONENT
============================================================ */
export default function Dashboard() {
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Enhancement: pull-to-refresh state
  const [filter, setFilter] = useState<FilterType>("This Week");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null); // Enhancement: last updated timestamp

  const lastFetchedAt = React.useRef<number | null>(null);
  const STALE_MS = 2 * 60 * 1000; // Reduced from 5 min → 2 min for fresher data

  const fetchBills = async (force = false) => {
    const now = Date.now();
    if (
      !force &&
      lastFetchedAt.current &&
      now - lastFetchedAt.current < STALE_MS
    ) {
      return;
    }

    try {
      setError(null);
      const uid = await getUserId();
      if (!uid) {
        setAllBills([]);
        setError("Could not find the logged-in user.");
        return;
      }

      const snap = await getDocs(
        query(collection(db, "users", uid, "bills"), orderBy("date", "desc"))
      );
      setAllBills(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Bill[]
      );
      lastFetchedAt.current = Date.now();
      setLastUpdated(new Date()); // Enhancement: stamp last updated time
    } catch (e) {
      console.error("Dashboard:", e);
      setAllBills([]);
      setError(
        "Could not load insights right now. Pull down to refresh and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Enhancement: pull-to-refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    fetchBills(true);
  };

  useFocusEffect(
    useCallback(() => {
      fetchBills();
    }, [])
  );

  // ── Derived Data ──
  const bills = allBills.filter((b) => new Date(b.date) >= getStartOf(filter));
  const totalRevenue = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
  const totalOrders = bills.length;
  const totalItems = bills.reduce((s, b) => s + (b.totalQty || 0), 0);
  const avgItems =
    totalOrders > 0 ? (totalItems / totalOrders).toFixed(1) : "0";
  const avgBillVal =
    totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Payment Logic
  const cashBills = bills.filter((b) => b.paymentMode === "Cash");
  const onlineBills = bills.filter((b) => b.paymentMode === "Online");
  const cashTotal = cashBills.reduce((s, b) => s + b.grandTotal, 0);
  const onlineTotal = onlineBills.reduce((s, b) => s + b.grandTotal, 0);
  const cashPct =
    totalRevenue > 0 ? Math.round((cashTotal / totalRevenue) * 100) : 0;
  const onlinePct =
    totalRevenue > 0 ? Math.round((onlineTotal / totalRevenue) * 100) : 0;

  // Peak Hours Logic
  const hourMap: Record<number, number> = {};
  bills.forEach((b) => {
    const h = new Date(b.date).getHours();
    hourMap[h] = (hourMap[h] || 0) + 1;
  });
  const peakEntry = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
  const peakHour = peakEntry ? Number(peakEntry[0]) : null;
  const peakLabel =
    peakHour === null ? null : HOUR_LABELS[peakHour] || `${peakHour}:00`;

  // FIX 1: Revenue Trend
  // - Today:      key by hour NUMBER (0–23) → sample into 6 four-hour buckets → 6 points, clean x-axis
  // - This Week:  key by day name → 7 points
  // - This Month: key by week number → dynamic week count, no phantom W5
  const revLineData = (() => {
    if (filter === "Today") {
      // Map revenue by hour number (0–23) — avoids label-string mismatch entirely
      const hourRevMap: Record<number, number> = {};
      bills.forEach((b) => {
        const h = new Date(b.date).getHours();
        hourRevMap[h] = (hourRevMap[h] || 0) + b.grandTotal;
      });
      // Aggregate into 6 buckets of 4 hours: [0-3], [4-7], [8-11], [12-15], [16-19], [20-23]
      const BUCKET_STARTS = [0, 4, 8, 12, 16, 20];
      const BUCKET_LABELS = ["12a", "4a", "8a", "12p", "4p", "8p"];
      const bucketData = BUCKET_STARTS.map((start) => {
        let total = 0;
        for (let h = start; h < start + 4; h++) total += hourRevMap[h] || 0;
        return total;
      });
      return {
        labels: BUCKET_LABELS,
        datasets: [{ data: bucketData }],
      };
    }

    if (filter === "This Week") {
      const m: Record<string, number> = {};
      bills.forEach((b) => {
        const key = DAYS[new Date(b.date).getDay()];
        m[key] = (m[key] || 0) + b.grandTotal;
      });
      return {
        labels: DAYS,
        datasets: [{ data: DAYS.map((d) => m[d] || 0) }],
      };
    }

    // This Month — dynamic week count, no phantom W5
    const m: Record<string, number> = {};
    bills.forEach((b) => {
      const key = `W${Math.ceil(new Date(b.date).getDate() / 7)}`;
      m[key] = (m[key] || 0) + b.grandTotal;
    });
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const weeksInMonth = Math.ceil(daysInMonth / 7);
    const weekLabels = Array.from({ length: weeksInMonth }, (_, i) => `W${i + 1}`);
    return {
      labels: weekLabels,
      datasets: [{ data: weekLabels.map((w) => m[w] || 0) }],
    };
  })();

  // FIX 2, 3, 4: Order Volume by Hour
  // Aggregate 24 hours into 6 four-hour buckets — exactly 6 bars + 6 labels, zero overlap.
  const HOUR_BUCKET_LABELS = ["12a", "4a", "8a", "12p", "4p", "8p"];
  const hourBarData = {
    labels: HOUR_BUCKET_LABELS,
    datasets: [{
      data: [0, 4, 8, 12, 16, 20].map((start) => {
        let count = 0;
        for (let h = start; h < start + 4; h++) count += hourMap[h] || 0;
        return count;
      }),
    }],
  };

  // Menu Engineering Logic
  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  bills.forEach((b) =>
    (b.items || []).forEach((it) => {
      if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0 };
      itemMap[it.name].qty += it.quantity;
      itemMap[it.name].revenue += it.price * it.quantity;
    })
  );
  const byQty = Object.entries(itemMap)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5);
  const byRev = Object.entries(itemMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Enhancement: Slow movers — only flag items sold below threshold (avoid flagging new items unfairly)
  const MIN_SLOW_MOVER_SALES = 1; // only include items that have at least 1 sale
  const slowMovers = Object.entries(itemMap)
    .filter(([, data]) => data.qty >= MIN_SLOW_MOVER_SALES)
    .sort((a, b) => a[1].qty - b[1].qty)
    .slice(0, 3);

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingTxt}>Crunching Numbers...</Text>
      </View>
    );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Analytics</Text>
          <Text style={s.headerSub}>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Business Intelligence Suite"}
          </Text>
        </View>
        <TouchableOpacity
          style={s.headerIconBox}
          onPress={() => fetchBills(true)}
        >
          <Ionicons name="refresh" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* FILTER TABS */}
      <View style={s.filterWrap}>
        {(["Today", "This Week", "This Month"] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterBtn, filter === f && s.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        // Enhancement: Pull-to-refresh
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
      >
        {error ? (
          <View style={s.empty}>
            <Ionicons name="cloud-offline-outline" size={80} color="#E2E8F0" />
            <Text style={s.emptyTitle}>Insights Unavailable</Text>
            <Text style={s.emptySub}>{error}</Text>
          </View>
        ) : bills.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="analytics" size={80} color="#E2E8F0" />
            <Text style={s.emptyTitle}>No Data Found</Text>
            <Text style={s.emptySub}>
              No bills recorded for this period yet.
            </Text>
          </View>
        ) : (
          <>
            {/* KPI ROW */}
            <View style={s.kpiRow}>
              <View style={[s.kpiCard, { backgroundColor: "#1D4ED8" }]}>
                <Text style={s.kpiLbl}>Total Revenue</Text>
                <Text style={s.kpiVal} adjustsFontSizeToFit numberOfLines={1}>
                  {formatINR(totalRevenue)}
                </Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: "#6D28D9" }]}>
                <Text style={s.kpiLbl}>Avg Items/Bill</Text>
                <Text style={s.kpiVal}>{avgItems}</Text>
              </View>
            </View>

            {/* Enhancement: Total Orders KPI */}
            <View style={s.kpiRow}>
              <View style={[s.kpiCard, { backgroundColor: "#0F766E" }]}>
                <Text style={s.kpiLbl}>Total Orders</Text>
                <Text style={s.kpiVal}>{totalOrders}</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: "#B45309" }]}>
                <Text style={s.kpiLbl}>Total Items Sold</Text>
                <Text style={s.kpiVal}>{totalItems}</Text>
              </View>
            </View>

            {/* OPERATIONAL EFFICIENCY */}
            <Text style={s.section}>Operational Efficiency</Text>
            <View style={s.effGrid}>
              <View style={s.effCard}>
                <Ionicons
                  name="speedometer-outline"
                  size={20}
                  color="#2563EB"
                />
                <Text style={s.effVal}>{formatINR(avgBillVal)}</Text>
                <Text style={s.effLbl}>Avg Bill Value</Text>
              </View>
              <View style={s.effCard}>
                <Ionicons name="time-outline" size={20} color="#EA580C" />
                <Text style={s.effVal}>{peakLabel || "N/A"}</Text>
                <Text style={s.effLbl}>Peak Hour</Text>
              </View>
            </View>

            {/* REVENUE TREND — FIX 1 applied via revLineData */}
            <Text style={s.section}>Revenue Trend</Text>
            <View style={s.chartCard}>
              <LineChart
                data={revLineData}
                width={CHART_W}
                height={200}
                chartConfig={CHART_CONFIG}
                bezier
                fromZero
                style={s.chartStyle}
                yAxisLabel="₹"
              />
            </View>

            {/* PAYMENT INTELLIGENCE — FIX 5 */}
            <Text style={s.section}>Payment Intelligence</Text>
            <View style={s.card}>
              <PieChart
                data={[
                  {
                    name: "Cash",
                    population: cashTotal || 0.001, // prevent zero-value crash
                    color: "#16A34A",
                    legendFontColor: "#475569",
                    legendFontSize: 12,
                  },
                  {
                    name: "Online",
                    population: onlineTotal || 0.001,
                    color: "#2563EB",
                    legendFontColor: "#475569",
                    legendFontSize: 12,
                  },
                ]}
                width={CHART_W}
                height={160}
                chartConfig={CHART_CONFIG}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
              />
              <View style={s.progressBarContainer}>
                <View
                  style={[
                    s.progressBar,
                    { flex: cashPct || 1, backgroundColor: "#16A34A" },
                  ]}
                />
                <View
                  style={[
                    s.progressBar,
                    { flex: onlinePct || 1, backgroundColor: "#2563EB" },
                  ]}
                />
              </View>
              {/* FIX 5: Show amount + percentage for each payment mode */}
              <View style={s.progressLabels}>
                <View style={s.paymentLabelGroup}>
                  <Text style={[s.progressText, { color: "#16A34A" }]}>
                    Cash {cashPct}%
                  </Text>
                  <Text style={[s.progressAmount, { color: "#16A34A" }]}>
                    {formatINR(cashTotal)}
                  </Text>
                </View>
                <View style={[s.paymentLabelGroup, { alignItems: "flex-end" }]}>
                  <Text style={[s.progressText, { color: "#2563EB" }]}>
                    Online {onlinePct}%
                  </Text>
                  <Text style={[s.progressAmount, { color: "#2563EB" }]}>
                    {formatINR(onlineTotal)}
                  </Text>
                </View>
              </View>
            </View>

            {/* PEAK HOURS BAR — FIX 2, 3, 4: hourBarData uses sparse labels */}
            <Text style={s.section}>Order Volume by Hour</Text>
            <View style={s.chartCard}>
              <BarChart
                data={hourBarData}
                width={CHART_W}
                height={200}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  ...CHART_CONFIG,
                  color: (o = 1) => `rgba(234, 88, 12, ${o})`,
                }}
                fromZero
                style={s.chartStyle}
                showValuesOnTopOfBars={false}
              />
            </View>

            {/* ITEM DEMAND */}
            <Text style={s.section}>
              Item Demand{" "}
              <Text style={s.sectionSub}>· Top 5 by Quantity</Text>
            </Text>
            <View style={s.card}>
              {byQty.length === 0 ? (
                <Text style={s.emptyCardTxt}>No item data available.</Text>
              ) : (
                byQty.map(([name, data], i) => (
                  <View key={name} style={s.barItemRow}>
                    <View style={s.barItemHeader}>
                      <Text style={s.itemName}>{name}</Text>
                      <Text style={s.itemQty}>{data.qty} sold</Text>
                    </View>
                    <View style={s.barBackground}>
                      <View
                        style={[
                          s.barFill,
                          {
                            width: `${
                              (data.qty / (byQty[0][1].qty || 1)) * 100
                            }%`,
                            backgroundColor: i === 0 ? "#2563EB" : "#94A3B8",
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* MENU ENGINEERING */}
            <Text style={s.section}>
              Menu Engineering{" "}
              <Text style={s.sectionSub}>· Top 5 by Revenue</Text>
            </Text>
            <View style={s.card}>
              {byRev.length === 0 ? (
                <Text style={s.emptyCardTxt}>No revenue data available.</Text>
              ) : (
                byRev.map(([name, data]) => (
                  <View key={name} style={s.barItemRow}>
                    <View style={s.barItemHeader}>
                      <Text style={s.itemName}>{name}</Text>
                      <Text style={[s.itemQty, { color: "#16A34A" }]}>
                        {formatINR(data.revenue)}
                      </Text>
                    </View>
                    <View style={s.barBackground}>
                      <View
                        style={[
                          s.barFill,
                          {
                            width: `${
                              (data.revenue / (byRev[0][1].revenue || 1)) * 100
                            }%`,
                            backgroundColor: "#16A34A",
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* SLOW MOVERS */}
            <Text style={s.section}>Slow Movers</Text>
            <View style={s.card}>
              {slowMovers.length === 0 ? (
                <Text style={s.emptyCardTxt}>No slow movers detected.</Text>
              ) : (
                <>
                  <View style={s.alert}>
                    <Ionicons name="warning" size={16} color="#EF4444" />
                    <Text style={s.alertTxt}>
                      Low sales detected. Consider updating prices or promoting
                      these items.
                    </Text>
                  </View>
                  {slowMovers.map(([name, data]) => (
                    <View key={name} style={s.slowRow}>
                      <Text style={s.itemName}>{name}</Text>
                      <Text style={s.slowQty}>{data.qty} sold</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingTxt: { marginTop: 10, color: "#64748B", fontWeight: "600" },
  header: {
    padding: SCREEN_PADDING,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerSub: { fontSize: 14, color: "#94A3B8" },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  filterWrap: {
    flexDirection: "row",
    marginHorizontal: SCREEN_PADDING,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  filterBtnActive: {
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterTxt: { fontWeight: "600", color: "#64748B", fontSize: 13 },
  filterTxtActive: { color: "#2563EB" },
  scroll: { paddingHorizontal: SCREEN_PADDING },
  section: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 25,
    marginBottom: 15,
    color: "#0F172A",
  },
  sectionSub: { fontSize: 13, fontWeight: "400", color: "#94A3B8" },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  kpiLbl: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  kpiVal: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 },
  effGrid: { flexDirection: "row", gap: 12 },
  effCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  effVal: { fontSize: 18, fontWeight: "800", marginTop: 8, color: "#1E293B" },
  effLbl: { fontSize: 12, color: "#64748B", marginTop: 2 },
  chartCard: {
    backgroundColor: "#fff",
    paddingVertical: 20,
    borderRadius: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    alignItems: "center",
  },
  chartStyle: { borderRadius: 16, marginLeft: -20 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  progressBarContainer: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 15,
  },
  progressBar: { height: "100%" },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  // FIX 5: New styles for payment label groups
  paymentLabelGroup: { flexDirection: "column", gap: 2 },
  progressText: { fontSize: 13, fontWeight: "700" },
  progressAmount: { fontSize: 12, fontWeight: "600", opacity: 0.85 }, // amount line below percentage
  barItemRow: { marginBottom: 16 },
  barItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
    marginRight: 8,
  },
  itemQty: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  barBackground: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  alertTxt: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  slowRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  slowQty: { color: "#EF4444", fontWeight: "700", fontSize: 12 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#CBD5E1",
    marginTop: 10,
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyCardTxt: { color: "#94A3B8", fontSize: 13, textAlign: "center", paddingVertical: 8 },
});