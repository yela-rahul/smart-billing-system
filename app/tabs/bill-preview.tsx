import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { getUserId } from "../../utils/authStore";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, runTransaction, collection } from "firebase/firestore";

/* ---------------- TYPES ---------------- */
type CartItem = { id: string; name: string; price: number; quantity: number; };
type Cart = { [key: string]: CartItem; };

export default function BillPreview() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [shopName, setShopName] = useState("Your Shop Name");
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(true);
  
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Online">("Cash");
  const [previewBillNo, setPreviewBillNo] = useState<number>(1);
  const [previewTokenNo, setPreviewTokenNo] = useState<number>(1);

  const cart: Cart = params.cart ? JSON.parse(params.cart as string) : {};
  const items = Object.values(cart);
  const subTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotal = Math.round(subTotal); 
  const roundOffValue = (grandTotal - subTotal).toFixed(2);

  /* ---------------- 1. SMART FETCH LOGIC ---------------- */
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function fetchLatestNumbers() {
        try {
          setCalculating(true);
          const uid = await getUserId();
          if (!uid) return;

          // Get Shop Name
          const userDoc = await getDoc(doc(db, "users", uid));
          if (isActive && userDoc.exists()) {
             setShopName(userDoc.data().shopName || "Your Shop");
          }

          // Check Database Counters
          const counterRef = doc(db, "users", uid, "metadata", "counters");
          const counterSnap = await getDoc(counterRef);
          
          const todayString = new Date().toDateString();

          if (isActive) {
            if (counterSnap.exists()) {
              const data = counterSnap.data();
              const dbBill = Number(data.totalBills) || 0;
              const dbToken = Number(data.dailyToken) || 0;
              const lastDate = data.lastBillDate;

              // Always increment Bill No
              setPreviewBillNo(dbBill + 1);

              // Increment Token only if it's the same day
              if (lastDate === todayString) {
                setPreviewTokenNo(dbToken + 1);
              } else {
                setPreviewTokenNo(1);
              }
            } else {
              // First Bill Ever
              setPreviewBillNo(1);
              setPreviewTokenNo(1);
            }
          }
        } catch (e) {
          console.log("Error:", e);
        } finally {
          if (isActive) setCalculating(false);
        }
      }

      fetchLatestNumbers();

      return () => { isActive = false; };
    }, [])
  );

  /* ---------------- 2. SAVE TRANSACTION ---------------- */
  const handleConfirm = async () => {
    if (items.length === 0) return;
    setLoading(true);

    try {
      const uid = await getUserId();
      if (!uid) return;

      const todayString = new Date().toDateString();
      const counterRef = doc(db, "users", uid, "metadata", "counters");
      const billsRef = collection(db, "users", uid, "bills");

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let newBillNo = 1;
        let newTokenNo = 1;

        if (counterDoc.exists()) {
          const data = counterDoc.data();
          const currentBill = Number(data.totalBills) || 0;
          const currentToken = Number(data.dailyToken) || 0;
          const lastDate = data.lastBillDate;

          newBillNo = currentBill + 1;

          if (lastDate === todayString) {
            newTokenNo = currentToken + 1;
          } else {
            newTokenNo = 1; 
          }
        }

        const billData = {
          billNo: newBillNo.toString(),
          tokenNo: newTokenNo.toString(),
          items: items,
          grandTotal: grandTotal,
          paymentMode: paymentMode,
          totalQty: totalQty,
          date: new Date().toISOString(),
          shopName: shopName,
        };

        const counterUpdate = {
          totalBills: newBillNo,
          dailyToken: newTokenNo,
          lastBillDate: todayString
        };

        const newBillRef = doc(billsRef); 
        transaction.set(newBillRef, billData);
        transaction.set(counterRef, counterUpdate, { merge: true });
      });

      router.replace({ pathname: "/tabs/new-bill", params: { clear: "true" } });

    } catch (error: any) {
      Alert.alert("Error", "Failed to generate bill.\n" + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Bill</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* RECEIPT CARD */}
        <View style={styles.receiptPaper}>
          
          {/* Shop Header */}
          <View style={styles.receiptHeader}>
            <Text style={styles.shopName}>{shopName}</Text>
            <Text style={styles.receiptMeta}>
              Date: {new Date().toLocaleDateString("en-IN")}  |  {new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
            </Text>
            
            {/* Bill & Token Row */}
            <View style={styles.metaRow}>
              {calculating ? (
                 <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <>
                  <Text style={styles.metaText}>Bill No: <Text style={styles.bold}>{previewBillNo}</Text></Text>
                  <Text style={styles.metaText}>Token: <Text style={styles.bold}>{previewTokenNo}</Text></Text>
                </>
              )}
            </View>
          </View>

          {/* Dashed Line */}
          <View style={styles.dashedLine} />

          {/* Table Header */}
          <View style={styles.rowHeader}>
            <Text style={[styles.colItem, styles.tableHead]}>ITEM</Text>
            <Text style={[styles.colQty, styles.tableHead]}>QTY</Text>
            <Text style={[styles.colPrice, styles.tableHead]}>PRICE</Text>
            <Text style={[styles.colAmt, styles.tableHead]}>AMT</Text>
          </View>

          {/* Items List */}
          <View style={styles.itemsContainer}>
            {items.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.colItem} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>{item.price}</Text>
                <Text style={styles.colAmt}>{(item.quantity * item.price)}</Text>
              </View>
            ))}
          </View>

          {/* Dashed Line */}
          <View style={styles.dashedLine} />

          {/* Totals Section */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.label}>Total Qty:</Text>
              <Text style={styles.value}>{totalQty}</Text>
            </View>
            
            <View style={styles.totalRow}>
              <Text style={styles.label}>Sub Total:</Text>
              <Text style={styles.value}>{subTotal}.00</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.label}>Round Off:</Text>
              <Text style={styles.value}>{Number(roundOffValue) > 0 ? "+" : ""}{roundOffValue}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.label}>Mode:</Text>
              <Text style={styles.value}>{paymentMode}</Text>
            </View>

            {/* Grand Total */}
            <View style={[styles.dashedLine, { marginTop: 8, marginBottom: 8 }]} />
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandLabel}>GRAND TOTAL</Text>
              <Text style={styles.grandValue}>₹ {grandTotal}</Text>
            </View>
          </View>

          {/* Footer Message */}
          <View style={styles.receiptFooter}>
            <Text style={styles.footerText}>*** Thank You! Visit Again ***</Text>
            <Text style={styles.poweredBy}>Powered by SmartBilling</Text>
          </View>
          
        </View>

        {/* Payment Selection */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Mode</Text>
          <View style={styles.paymentButtons}>
            <TouchableOpacity 
              style={[styles.payBtn, paymentMode === "Cash" && styles.payBtnActive]}
              onPress={() => setPaymentMode("Cash")}
            >
              <Ionicons name="cash-outline" size={20} color={paymentMode === "Cash" ? "#fff" : "#64748B"} />
              <Text style={[styles.payText, paymentMode === "Cash" && styles.payTextActive]}>Cash</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.payBtn, paymentMode === "Online" && styles.payBtnActive]}
              onPress={() => setPaymentMode("Online")}
            >
              <Ionicons name="qr-code-outline" size={20} color={paymentMode === "Online" ? "#fff" : "#64748B"} />
              <Text style={[styles.payText, paymentMode === "Online" && styles.payTextActive]}>Online</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Action Button */}
      <View style={styles.footerAction}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={loading || calculating}>
          <Text style={styles.confirmText}>
             {loading ? "Printing..." : `Confirm & Print ₹${grandTotal}`}
          </Text>
          {!loading && <Ionicons name="print-outline" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    elevation: 2,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#0F172A" },

  scrollContent: { padding: 16, paddingBottom: 120 },

  /* RECEIPT STYLES */
  receiptPaper: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 8,
    // Paper Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  receiptHeader: { alignItems: "center", marginBottom: 12 },
  shopName: { fontSize: 22, fontWeight: "800", textTransform: "uppercase", color: "#000" },
  receiptMeta: { fontSize: 12, color: "#64748B", marginTop: 4 },
  
  metaRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  metaText: { fontSize: 16, color: "#334155" }, // Increased Size
  bold: { fontWeight: "800", color: "#000", fontSize: 18 }, // Bold and Bigger

  dashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 1,
    marginVertical: 12,
  },

  /* TABLE */
  rowHeader: { flexDirection: "row", marginBottom: 8 },
  itemsContainer: { gap: 8 },
  row: { flexDirection: "row" },
  
  colItem: { flex: 2, fontSize: 14, color: "#334155", fontWeight: "600", textTransform: 'uppercase' },
  colQty: { flex: 0.5, fontSize: 14, textAlign: "center", color: "#334155" },
  colPrice: { flex: 0.8, fontSize: 14, textAlign: "right", color: "#334155" },
  colAmt: { flex: 0.8, fontSize: 14, textAlign: "right", fontWeight: "700", color: "#000" },
  
  tableHead: { fontWeight: "700", color: "#0F172A", textTransform: "uppercase", fontSize: 12 },

  /* TOTALS */
  totalsSection: { marginTop: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 14, color: "#64748B" },
  value: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  grandLabel: { fontSize: 18, fontWeight: "800", textTransform: "uppercase" },
  grandValue: { fontSize: 24, fontWeight: "800", color: "#000" },

  /* RECEIPT FOOTER */
  receiptFooter: { alignItems: "center", marginTop: 20 },
  footerText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  poweredBy: { fontSize: 10, color: "#94A3B8", marginTop: 4 },

  /* PAYMENT SELECTOR */
  paymentSection: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#0F172A" },
  paymentButtons: { flexDirection: "row", gap: 12 },
  payBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  payBtnActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  payText: { fontWeight: "600", color: "#64748B" },
  payTextActive: { color: "#fff" },

  /* BOTTOM ACTION */
  footerAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  confirmBtn: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});