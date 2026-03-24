import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { getUserId } from "../../utils/authStore";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";

const { width } = Dimensions.get("window");
const SCREEN_PADDING = 20;
const CHART_W = width - (SCREEN_PADDING * 2);

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
const PEAK_SLOTS  = [6, 8, 10, 12, 14, 16, 18, 20, 22];
const PEAK_LABELS = ["6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"];

const getStartOf = (filter: FilterType): Date => {
  const now = new Date();
  if (filter === "Today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
  paddingRight: 35, // Fixes cut-off labels
};

/* ============================================================
   MAIN COMPONENT
============================================================ */
export default function Dashboard() {
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterType>("This Week");

  // Track when we last fetched — avoid re-fetching on every tab switch
  const lastFetchedAt = React.useRef<number | null>(null);
  const STALE_MS = 5 * 60 * 1000; // 5 minutes — re-fetch only if data is older than this

  const fetchBills = async (force = false) => {
    // Skip fetch if data is fresh and not forced
    const now = Date.now();
    if (!force && lastFetchedAt.current && (now - lastFetchedAt.current) < STALE_MS) {
      return; // Data is still fresh — no Firestore call needed
    }

    try {
      setLoading(true);
      const uid = await getUserId();
      if (!uid) return;

      // Only fetch last 31 days — covers Today, This Week, This Month
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 31);

      const snap = await getDocs(
        query(
          collection(db, "users", uid, "bills"),
          where("date", ">=", oneMonthAgo.toISOString()),
          orderBy("date", "desc")
        )
      );
      setAllBills(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Bill[]);
      lastFetchedAt.current = Date.now(); // stamp the fetch time
    } catch (e) {
      console.error("Dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  // On tab focus — only fetch if data is stale (not on every single tab switch)
  useFocusEffect(useCallback(() => { fetchBills(); }, []));

  // ── Derived Data & Logic ──
  const bills = allBills.filter((b) => new Date(b.date) >= getStartOf(filter));
  const totalRevenue = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
  const totalOrders = bills.length;
  const totalItems = bills.reduce((s, b) => s + (b.totalQty || 0), 0);
  const avgItems = totalOrders > 0 ? (totalItems / totalOrders).toFixed(1) : "0";
  const avgBillVal = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Payment Logic
  const cashTotal = bills.filter(b => b.paymentMode === "Cash").reduce((s, b) => s + b.grandTotal, 0);
  const onlineTotal = bills.filter(b => b.paymentMode === "Online").reduce((s, b) => s + b.grandTotal, 0);
  const cashPct = totalRevenue > 0 ? Math.round((cashTotal / totalRevenue) * 100) : 0;
  const onlinePct = totalRevenue > 0 ? Math.round((onlineTotal / totalRevenue) * 100) : 0;

  // Peak Hours Logic
  const hourMap: Record<number, number> = {};
  bills.forEach(b => {
    const h = new Date(b.date).getHours();
    hourMap[h] = (hourMap[h] || 0) + 1;
  });
  const peakEntry = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
  const peakLabel = peakEntry ? (PEAK_LABELS[PEAK_SLOTS.indexOf(Math.floor(Number(peakEntry[0])/2)*2)] || `${peakEntry[0]}:00`) : null;

  // Revenue Line Logic
  const revLineData = (() => {
    const m: Record<string, number> = {};
    bills.forEach(b => {
      const key = filter === "Today" ? new Date(b.date).getHours().toString() : 
                  filter === "This Week" ? DAYS[new Date(b.date).getDay()] :
                  `W${Math.ceil(new Date(b.date).getDate() / 7)}`;
      m[key] = (m[key] || 0) + b.grandTotal;
    });
    const labels = filter === "Today" ? PEAK_LABELS : filter === "This Week" ? DAYS : ["W1", "W2", "W3", "W4"];
    return { labels, datasets: [{ data: labels.map((l, i) => m[filter === "Today" ? PEAK_SLOTS[i] : l] || 0) }] };
  })();

  // Menu Engineering Logic
  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  bills.forEach((b) => (b.items || []).forEach((it) => {
    if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0 };
    itemMap[it.name].qty += it.quantity;
    itemMap[it.name].revenue += it.price * it.quantity;
  }));
  const byQty = Object.entries(itemMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const byRev = Object.entries(itemMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const slowMovers = Object.entries(itemMap).sort((a, b) => a[1].qty - b[1].qty).slice(0, 3);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#2563EB" /><Text style={s.loadingTxt}>Crunching Numbers...</Text></View>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* HEADER */}
      <View style={s.header}>
        <View><Text style={s.headerTitle}>Analytics</Text><Text style={s.headerSub}>Business Intelligence Suite</Text></View>
        <TouchableOpacity style={s.headerIconBox} onPress={() => fetchBills(true)}><Ionicons name="refresh" size={20} color="#2563EB" /></TouchableOpacity>
      </View>

      {/* FILTER TABS */}
      <View style={s.filterWrap}>
        {["Today", "This Week", "This Month"].map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterBtnActive]} onPress={() => setFilter(f as FilterType)}>
            <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {bills.length === 0 ? (
          <View style={s.empty}><Ionicons name="analytics" size={80} color="#E2E8F0" /><Text style={s.emptyTitle}>No Data Found</Text></View>
        ) : (
          <>
            {/* KPI ROW */}
            <View style={s.kpiRow}>
              <View style={[s.kpiCard, { backgroundColor: "#1D4ED8" }]}>
                <Text style={s.kpiLbl}>Total Revenue</Text>
                <Text style={s.kpiVal} adjustsFontSizeToFit numberOfLines={1}>{formatINR(totalRevenue)}</Text>
              </View>
              <View style={[s.kpiCard, { backgroundColor: "#6D28D9" }]}>
                <Text style={s.kpiLbl}>Avg Items/Bill</Text>
                <Text style={s.kpiVal}>{avgItems}</Text>
              </View>
            </View>

            {/* OPERATIONAL EFFICIENCY GRID */}
            <Text style={s.section}>Operational Efficiency</Text>
            <View style={s.effGrid}>
              <View style={s.effCard}><Ionicons name="speedometer-outline" size={20} color="#2563EB" /><Text style={s.effVal}>{formatINR(avgBillVal)}</Text><Text style={s.effLbl}>Avg Bill Value</Text></View>
              <View style={s.effCard}><Ionicons name="time-outline" size={20} color="#EA580C" /><Text style={s.effVal}>{peakLabel || "N/A"}</Text><Text style={s.effLbl}>Peak Hour</Text></View>
            </View>

            {/* REVENUE TREND */}
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

            {/* PAYMENT INTELLIGENCE */}
            <Text style={s.section}>Payment Intelligence</Text>
            <View style={s.card}>
              <PieChart
                data={[
                  { name: "Cash", population: cashTotal, color: "#16A34A", legendFontColor: "#475569", legendFontSize: 12 },
                  { name: "Online", population: onlineTotal, color: "#2563EB", legendFontColor: "#475569", legendFontSize: 12 }
                ]}
                width={CHART_W} height={160} chartConfig={CHART_CONFIG} accessor="population" backgroundColor="transparent" paddingLeft="15"
              />
              <View style={s.progressBarContainer}>
                <View style={[s.progressBar, { flex: cashPct || 1, backgroundColor: "#16A34A" }]} />
                <View style={[s.progressBar, { flex: onlinePct || 1, backgroundColor: "#2563EB" }]} />
              </View>
              <View style={s.progressLabels}>
                <Text style={[s.progressText, { color: "#16A34A" }]}>Cash {cashPct}%</Text>
                <Text style={[s.progressText, { color: "#2563EB" }]}>Online {onlinePct}%</Text>
              </View>
            </View>

            {/* PEAK HOURS BAR */}
            <Text style={s.section}>Order Volume by Hour</Text>
            <View style={s.chartCard}>
              <BarChart
                data={{ labels: PEAK_LABELS, datasets: [{ data: PEAK_SLOTS.map(h => hourMap[h] || 0) }] }}
                width={CHART_W} height={200} yAxisLabel="" yAxisSuffix=""
                chartConfig={{ ...CHART_CONFIG, color: (o=1) => `rgba(234, 88, 12, ${o})` }}
                fromZero style={s.chartStyle}
              />
            </View>

            {/* ITEM DEMAND */}
            <Text style={s.section}>Item Demand <Text style={s.sectionSub}>· Top 5</Text></Text>
            <View style={s.card}>
              {byQty.map(([name, data], i) => (
                <View key={name} style={s.barItemRow}>
                  <View style={s.barItemHeader}><Text style={s.itemName}>{name}</Text><Text style={s.itemQty}>{data.qty} sold</Text></View>
                  <View style={s.barBackground}><View style={[s.barFill, { width: `${(data.qty / (byQty[0][1].qty || 1)) * 100}%`, backgroundColor: i === 0 ? "#2563EB" : "#94A3B8" }]} /></View>
                </View>
              ))}
            </View>

            {/* MENU ENGINEERING */}
            <Text style={s.section}>Menu Engineering <Text style={s.sectionSub}>· Top Revenue</Text></Text>
            <View style={s.card}>
              {byRev.map(([name, data], i) => (
                <View key={name} style={s.barItemRow}>
                  <View style={s.barItemHeader}><Text style={s.itemName}>{name}</Text><Text style={[s.itemQty, { color: "#16A34A" }]}>{formatINR(data.revenue)}</Text></View>
                  <View style={s.barBackground}><View style={[s.barFill, { width: `${(data.revenue / (byRev[0][1].revenue || 1)) * 100}%`, backgroundColor: "#16A34A" }]} /></View>
                </View>
              ))}
            </View>

            {/* SLOW MOVERS */}
            <Text style={s.section}>Slow Movers</Text>
            <View style={s.card}>
              <View style={s.alert}><Ionicons name="warning" size={16} color="#EF4444" /><Text style={s.alertTxt}>Low sales detected. Consider updating prices.</Text></View>
              {slowMovers.map(([name, data]) => (
                <View key={name} style={s.slowRow}><Text style={s.itemName}>{name}</Text><Text style={s.slowQty}>{data.qty} sold</Text></View>
              ))}
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
  header: { padding: SCREEN_PADDING, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: "#94A3B8" },
  headerIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },
  filterWrap: { flexDirection: "row", marginHorizontal: SCREEN_PADDING, backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4, marginBottom: 10 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  filterBtnActive: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4 },
  filterTxt: { fontWeight: "600", color: "#64748B", fontSize: 13 },
  filterTxtActive: { color: "#2563EB" },
  scroll: { paddingHorizontal: SCREEN_PADDING },
  section: { fontSize: 18, fontWeight: "700", marginTop: 25, marginBottom: 15, color: "#0F172A" },
  sectionSub: { fontSize: 13, fontWeight: "400", color: "#94A3B8" },
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiCard: { flex: 1, padding: 16, borderRadius: 20, elevation: 3, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
  kpiLbl: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  kpiVal: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 },
  effGrid: { flexDirection: "row", gap: 12 },
  effCard: { flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 20, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  effVal: { fontSize: 18, fontWeight: "800", marginTop: 8, color: "#1E293B" },
  effLbl: { fontSize: 12, color: "#64748B", marginTop: 2 },
  chartCard: { backgroundColor: "#fff", paddingVertical: 20, borderRadius: 20, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, alignItems: "center" },
  chartStyle: { borderRadius: 16, marginLeft: -20 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 20, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  progressBarContainer: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 15 },
  progressBar: { height: "100%" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  progressText: { fontSize: 12, fontWeight: "700" },
  barItemRow: { marginBottom: 16 },
  barItemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  itemName: { fontSize: 14, fontWeight: "600", color: "#1E293B", flex: 1 },
  itemQty: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  barBackground: { height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  alert: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF2F2", padding: 10, borderRadius: 10, marginBottom: 12 },
  alertTxt: { color: "#EF4444", fontSize: 12, fontWeight: "600", marginLeft: 8, flex: 1 },
  slowRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  slowQty: { color: "#EF4444", fontWeight: "700", fontSize: 12 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#CBD5E1", marginTop: 10 },
});