/**
 * printer-settings.tsx
 * ─────────────────────────────────────────────────────
 * Screen where the user scans, pairs, and saves
 * their Bluetooth thermal printer.
 *
 * Accessible from: Profile screen → Printer Settings
 * ─────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  scanForPrinters,
  connectToPrinter,
  printBill,
  PrinterDevice,
} from "../utils/bluetoothPrinter";

/* ── Storage key for saved printer ── */
const PRINTER_STORAGE_KEY = "savedPrinter";

/* ── Save / load printer from AsyncStorage ── */
export const getSavedPrinter = async (): Promise<PrinterDevice | null> => {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const savePrinterToStorage = async (printer: PrinterDevice): Promise<void> => {
  await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(printer));
};

export const clearSavedPrinter = async (): Promise<void> => {
  await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
};

/* ================================================================
   MAIN COMPONENT
================================================================ */
export default function PrinterSettings() {
  const router = useRouter();

  const [devices, setDevices]           = useState<PrinterDevice[]>([]);
  const [scanning, setScanning]         = useState(false);
  const [connecting, setConnecting]     = useState<string | null>(null); // address being connected
  const [savedPrinter, setSavedPrinter] = useState<PrinterDevice | null>(null);
  const [testPrinting, setTestPrinting] = useState(false);

  /* ── Load saved printer on mount ── */
  React.useEffect(() => {
    getSavedPrinter().then(setSavedPrinter);
  }, []);

  /* ── Scan for nearby printers ── */
  const handleScan = useCallback(async () => {
    try {
      setScanning(true);
      setDevices([]);
      const found = await scanForPrinters();
      setDevices(found);
      if (found.length === 0) {
        Alert.alert(
          "No Printers Found",
          "Make sure your printer is ON and paired with this phone in Bluetooth Settings."
        );
      }
    } catch (error: any) {
      Alert.alert("Scan Failed", error.message);
    } finally {
      setScanning(false);
    }
  }, []);

  /* ── Connect and save printer ── */
  const handleSelectPrinter = useCallback(async (device: PrinterDevice) => {
    try {
      setConnecting(device.address);
      await connectToPrinter(device.address);
      await savePrinterToStorage(device);
      setSavedPrinter(device);
      Alert.alert(
        "Printer Saved ✅",
        `"${device.name}" is now your default printer.`
      );
    } catch (error: any) {
      Alert.alert("Connection Failed", error.message);
    } finally {
      setConnecting(null);
    }
  }, []);

  /* ── Test print ── */
  const handleTestPrint = useCallback(async () => {
    if (!savedPrinter) return;
    try {
      setTestPrinting(true);
      await connectToPrinter(savedPrinter.address);
      await printBill({
        shopName:    "TEST SHOP",
        billNo:      "001",
        tokenNo:     "01",
        date:        new Date().toISOString(),
        items:       [
          { name: "Test Item 1", price: 100, quantity: 2 },
          { name: "Test Item 2", price: 50,  quantity: 1 },
        ],
        subTotal:    250,
        grandTotal:  250,
        roundOff:    0,
        totalQty:    3,
        paymentMode: "Cash",
      });
      Alert.alert("Test Print Sent ✅", "Check if the printer printed correctly.");
    } catch (error: any) {
      Alert.alert("Test Print Failed", error.message);
    } finally {
      setTestPrinting(false);
    }
  }, [savedPrinter]);

  /* ── Remove saved printer ── */
  const handleRemovePrinter = useCallback(() => {
    Alert.alert(
      "Remove Printer",
      `Remove "${savedPrinter?.name}" as your default printer?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await clearSavedPrinter();
            setSavedPrinter(null);
            setDevices([]);
          },
        },
      ]
    );
  }, [savedPrinter]);

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Printer Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.address}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* ── Current printer card ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Printer</Text>

              {savedPrinter ? (
                <View style={styles.savedCard}>
                  <View style={styles.savedLeft}>
                    <View style={styles.printerIconBox}>
                      <Ionicons name="print" size={22} color="#2563EB" />
                    </View>
                    <View>
                      <Text style={styles.savedName}>{savedPrinter.name}</Text>
                      <Text style={styles.savedAddress}>{savedPrinter.address}</Text>
                      <View style={styles.connectedBadge}>
                        <View style={styles.connectedDot} />
                        <Text style={styles.connectedText}>Saved as default</Text>
                      </View>
                    </View>
                  </View>

                  {/* Test print + remove */}
                  <View style={styles.savedActions}>
                    <TouchableOpacity
                      style={styles.testBtn}
                      onPress={handleTestPrint}
                      disabled={testPrinting}
                    >
                      {testPrinting ? (
                        <ActivityIndicator size="small" color="#2563EB" />
                      ) : (
                        <>
                          <Ionicons name="print-outline" size={16} color="#2563EB" />
                          <Text style={styles.testBtnText}>Test</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={handleRemovePrinter}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.noPrinterCard}>
                  <Ionicons name="print-outline" size={32} color="#CBD5E1" />
                  <Text style={styles.noPrinterText}>No printer saved yet</Text>
                  <Text style={styles.noPrinterSub}>
                    Scan and select your Bluetooth printer below
                  </Text>
                </View>
              )}
            </View>

            {/* ── How to pair guide ── */}
            <View style={styles.guideCard}>
              <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
              <Text style={styles.guideText}>
                First pair your printer in{" "}
                <Text style={styles.guideBold}>Android Bluetooth Settings</Text>,
                then scan here to select it.
              </Text>
            </View>

            {/* ── Scan button ── */}
            <TouchableOpacity
              style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
              onPress={handleScan}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.scanBtnText}>Scanning...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="bluetooth" size={20} color="#fff" />
                  <Text style={styles.scanBtnText}>
                    {devices.length > 0 ? "Scan Again" : "Scan for Printers"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* ── Device list header ── */}
            {devices.length > 0 && (
              <Text style={styles.sectionTitle}>
                {devices.length} Printer{devices.length !== 1 ? "s" : ""} Found
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => {
          const isConnecting = connecting === item.address;
          const isSaved      = savedPrinter?.address === item.address;

          return (
            <TouchableOpacity
              style={[styles.deviceCard, isSaved && styles.deviceCardSaved]}
              onPress={() => handleSelectPrinter(item)}
              disabled={isConnecting}
              activeOpacity={0.7}
            >
              <View style={styles.deviceLeft}>
                <View style={[styles.deviceIcon, isSaved && styles.deviceIconSaved]}>
                  <Ionicons
                    name="print-outline"
                    size={20}
                    color={isSaved ? "#fff" : "#64748B"}
                  />
                </View>
                <View>
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceAddress}>{item.address}</Text>
                </View>
              </View>

              {isConnecting ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : isSaved ? (
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                  <Text style={styles.savedBadgeText}>Saved</Text>
                </View>
              ) : (
                <View style={styles.connectBadge}>
                  <Text style={styles.connectBadgeText}>Select</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !scanning ? null : (
            <View style={styles.scanningState}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.scanningText}>Looking for printers...</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

/* ================================================================
   STYLES
================================================================ */
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, paddingBottom: 60 },

  /* Header */
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    backgroundColor:   "#F8FAFC",
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: "#F1F5F9",
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },

  /* Section */
  section:      { marginBottom: 16 },
  sectionTitle: {
    fontSize:     14,
    fontWeight:   "700",
    color:        "#64748B",
    marginBottom: 10,
    textTransform:"uppercase",
    letterSpacing: 0.6,
  },

  /* Saved printer card */
  savedCard: {
    backgroundColor: "#fff",
    borderRadius:    16,
    padding:         16,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    borderWidth:     1.5,
    borderColor:     "#DBEAFE",
    shadowColor:     "#2563EB",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       2,
  },
  savedLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  printerIconBox: {
    width:           46,
    height:          46,
    borderRadius:    14,
    backgroundColor: "#EFF6FF",
    alignItems:      "center",
    justifyContent:  "center",
  },
  savedName:    { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  savedAddress: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  connectedBadge: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            4,
    marginTop:      4,
  },
  connectedDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: "#16A34A",
  },
  connectedText: { fontSize: 11, color: "#16A34A", fontWeight: "600" },

  savedActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  testBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      10,
    backgroundColor:   "#EFF6FF",
    borderWidth:       1,
    borderColor:       "#DBEAFE",
  },
  testBtnText: { fontSize: 13, fontWeight: "600", color: "#2563EB" },
  removeBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: "#FEF2F2",
    alignItems:      "center",
    justifyContent:  "center",
  },

  /* No printer */
  noPrinterCard: {
    backgroundColor: "#fff",
    borderRadius:    16,
    padding:         28,
    alignItems:      "center",
    borderWidth:     1,
    borderColor:     "#E2E8F0",
    borderStyle:     "dashed",
  },
  noPrinterText: { marginTop: 12, fontSize: 15, fontWeight: "600", color: "#94A3B8" },
  noPrinterSub:  { marginTop: 4, fontSize: 12, color: "#CBD5E1", textAlign: "center" },

  /* Guide card */
  guideCard: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            10,
    backgroundColor:"#EFF6FF",
    borderRadius:   12,
    padding:        12,
    marginBottom:   16,
    borderWidth:    1,
    borderColor:    "#DBEAFE",
  },
  guideText: { flex: 1, fontSize: 13, color: "#1E40AF", lineHeight: 18 },
  guideBold: { fontWeight: "700" },

  /* Scan button */
  scanBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
    backgroundColor:"#2563EB",
    borderRadius:   14,
    paddingVertical:14,
    marginBottom:   20,
    shadowColor:    "#2563EB",
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.3,
    shadowRadius:   8,
    elevation:      6,
  },
  scanBtnDisabled: { backgroundColor: "#93C5FD", elevation: 0, shadowOpacity: 0 },
  scanBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  /* Device list */
  deviceCard: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    backgroundColor: "#fff",
    borderRadius:    14,
    padding:         14,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     "#F1F5F9",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    4,
    elevation:       1,
  },
  deviceCardSaved: {
    borderColor: "#DBEAFE",
    borderWidth: 1.5,
  },
  deviceLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  deviceIcon: {
    width:           42,
    height:          42,
    borderRadius:    12,
    backgroundColor: "#F1F5F9",
    alignItems:      "center",
    justifyContent:  "center",
  },
  deviceIconSaved: { backgroundColor: "#2563EB" },
  deviceName:    { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  deviceAddress: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  savedBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   "#2563EB",
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      8,
  },
  savedBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  connectBadge: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       "#E2E8F0",
    backgroundColor:   "#F8FAFC",
  },
  connectBadgeText: { fontSize: 12, fontWeight: "600", color: "#64748B" },

  /* Scanning state */
  scanningState: { alignItems: "center", paddingTop: 40 },
  scanningText:  { marginTop: 12, fontSize: 14, color: "#64748B", fontWeight: "500" },
});