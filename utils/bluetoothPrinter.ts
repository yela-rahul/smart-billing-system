/**
 * bluetoothPrinter.ts
 * ─────────────────────────────────────────────────────
 * Core Bluetooth ESC/POS printing utility.
 * Works with any 58mm thermal printer (Xprinter, RONGTA, TVS etc.)
 *
 * IMPORTANT: This file uses react-native-bluetooth-escpos-printer
 * which only works in Expo Dev Build — NOT in Expo Go.
 * During development the printBill() function will simulate
 * printing and log the receipt to console instead.
 * ─────────────────────────────────────────────────────
 */

// ── Type Definitions ──────────────────────────────────

export type PrinterDevice = {
  name:    string;  // e.g. "Xprinter XP-58"
  address: string;  // Bluetooth MAC address e.g. "AA:BB:CC:DD:EE:FF"
};

export type BillPrintData = {
  shopName:    string;
  billNo:      string;
  tokenNo:     string;
  date:        string;         // ISO string
  items:       PrintItem[];
  subTotal:    number;
  grandTotal:  number;
  roundOff:    number;
  totalQty:    number;
  paymentMode: "Cash" | "Online";
};

export type PrintItem = {
  name:      string;
  price:     number;
  quantity:  number;
};

export type PrintStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "printing"
  | "success"
  | "error";

// ── Constants ─────────────────────────────────────────

// ✅ FIXED: Correct way to detect Expo Go vs Dev Build
import Constants from "expo-constants";
import { PermissionsAndroid, Platform } from "react-native";
const IS_EXPO_GO = Constants.appOwnership === "expo";

// Paper width for 58mm printer = 32 characters
const PAPER_WIDTH = 32;

const ensureBluetoothPermissions = async (): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }

  const permissions =
    Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

  const results = await PermissionsAndroid.requestMultiple(permissions);
  const deniedPermissions = permissions.filter(
    (permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED
  );

  if (deniedPermissions.length > 0) {
    throw new Error(
      "Bluetooth permission is required to scan printers. Please allow Nearby devices/Bluetooth permission in Android settings."
    );
  }
};

const normalizeDevices = (devices: any[] = []): PrinterDevice[] => {
  const uniqueDevices = new Map<string, PrinterDevice>();

  devices.forEach((device) => {
    if (!device?.address || uniqueDevices.has(device.address)) {
      return;
    }

    uniqueDevices.set(device.address, {
      name: device.name || "Unknown Printer",
      address: device.address,
    });
  });

  return Array.from(uniqueDevices.values());
};

const parsePairedDevices = (devices: any): PrinterDevice[] => {
  if (!Array.isArray(devices)) {
    return [];
  }

  const parsed = devices.map((device) => {
    if (typeof device === "string") {
      try {
        return JSON.parse(device);
      } catch {
        return null;
      }
    }

    return device;
  });

  return normalizeDevices(parsed.filter(Boolean));
};

// ── Formatting Helpers ────────────────────────────────

/**
 * Centers text within the paper width
 */
const center = (text: string): string => {
  const pad = Math.max(0, Math.floor((PAPER_WIDTH - text.length) / 2));
  return " ".repeat(pad) + text;
};

/**
 * Left-right aligned text on one line
 */
const leftRight = (left: string, right: string): string => {
  const maxLeft = PAPER_WIDTH - right.length - 1;
  const trimmed = left.length > maxLeft ? left.slice(0, maxLeft - 1) + "." : left;
  const gap = PAPER_WIDTH - trimmed.length - right.length;
  return trimmed + " ".repeat(Math.max(1, gap)) + right;
};

/**
 * Dashed separator line
 */
const divider = (): string => "-".repeat(PAPER_WIDTH);

/**
 * Formats a number as Indian currency string
 */
const inr = (amount: number): string =>
  amount.toLocaleString("en-IN", { minimumFractionDigits: 2 });

// ── Receipt Builder ───────────────────────────────────

/**
 * Builds the complete receipt as an array of text lines.
 */
export const buildReceiptLines = (bill: BillPrintData): string[] => {
  const date = new Date(bill.date);
  const dateStr = date.toLocaleDateString("en-IN", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-IN", {
    hour:   "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = [
    "",
    center(bill.shopName.toUpperCase()),
    center("RECEIPT"),
    divider(),
    leftRight("Date: " + dateStr, timeStr),
    leftRight("Bill No:", "#" + bill.billNo),
    leftRight("Token No:", "#" + bill.tokenNo),
    divider(),
    "ITEM             QTY   AMOUNT",
    divider(),
  ];

  bill.items.forEach((item) => {
    const amount = item.price * item.quantity;
    const name = item.name.length > 16
      ? item.name.slice(0, 15) + "."
      : item.name.padEnd(16);
    const qty   = String(item.quantity).padStart(3);
    const amt   = inr(amount).padStart(8);
    lines.push(`${name} ${qty}  ${amt}`);
  });

  lines.push(
    divider(),
    leftRight("Total Qty:",    String(bill.totalQty)),
    leftRight("Sub Total:",    "Rs." + inr(bill.subTotal)),
    leftRight("Round Off:",    (bill.roundOff >= 0 ? "+" : "") + bill.roundOff.toFixed(2)),
    leftRight("Payment Mode:", bill.paymentMode),
    divider(),
    leftRight("GRAND TOTAL:", "Rs." + inr(bill.grandTotal)),
    divider(),
    "",
    center("** Thank You! Visit Again **"),
    center("Powered by SmartBilling"),
    "",
    "",  // Feed paper before cut
  );

  return lines;
};

// ── Bluetooth Printer API ─────────────────────────────

/**
 * Scans for nearby Bluetooth devices.
 * In Expo Go: returns mock devices.
 * In Dev Build: returns real paired BT devices.
 */
export const scanForPrinters = async (): Promise<PrinterDevice[]> => {
  // ── DEVELOPMENT MODE (Expo Go) ──
  if (IS_EXPO_GO) {
    console.log("[BT] Expo Go detected — returning mock printers");
    await new Promise((r) => setTimeout(r, 1500));
    return [
      { name: "Xprinter XP-58",  address: "AA:BB:CC:DD:EE:01" },
      { name: "RONGTA RPP02N",   address: "AA:BB:CC:DD:EE:02" },
      { name: "BT Printer",      address: "AA:BB:CC:DD:EE:03" },
    ];
  }

  // ── PRODUCTION MODE (Dev Build / APK) ──
  try {
    const { BluetoothManager } =
      require("react-native-bluetooth-escpos-printer") as typeof import("react-native-bluetooth-escpos-printer");

    await ensureBluetoothPermissions();

    const enabledResponse = await BluetoothManager.enableBluetooth();
    const pairedDevices = parsePairedDevices(enabledResponse);

    if (pairedDevices.length > 0) {
      return pairedDevices;
    }
    throw new Error(
      "No paired Bluetooth printers found. First pair the printer in Android Bluetooth settings, then try again."
    );
  } catch (error: any) {
    console.error("[BT] Scan error:", error);
    const rawMessage =
      typeof error?.message === "string"
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    const message = rawMessage.toLowerCase();

    if (
      message.includes("permission") ||
      message.includes("nearby") ||
      message.includes("access_coarse_location")
    ) {
      throw new Error(
        "Bluetooth permission was denied. Allow Nearby devices/Bluetooth permission and try again."
      );
    }

    if (message.includes("bt not enabled") || message.includes("not enabled")) {
      throw new Error("Bluetooth is turned off. Please turn it on and try again.");
    }

    throw new Error(
      "Could not load paired printers. Make sure Bluetooth is on and the printer is already paired in Android Bluetooth settings."
    );
  }
};

/**
 * Connects to a Bluetooth printer by MAC address.
 */
export const connectToPrinter = async (address: string): Promise<boolean> => {
  // ── DEVELOPMENT MODE ──
  if (IS_EXPO_GO) {
    console.log("[BT] Mock connecting to:", address);
    await new Promise((r) => setTimeout(r, 1000));
    console.log("[BT] Mock connection successful");
    return true;
  }

  // ── PRODUCTION MODE ──
  try {
    const { BluetoothManager } =
      require("react-native-bluetooth-escpos-printer") as typeof import("react-native-bluetooth-escpos-printer");

    await BluetoothManager.connect(address);
    console.log("[BT] Connected to:", address);
    return true;
  } catch (error) {
    console.error("[BT] Connection error:", error);
    throw new Error("Could not connect to printer. Make sure it is on and nearby.");
  }
};

/**
 * Prints a bill to the connected Bluetooth printer.
 */
export const printBill = async (bill: BillPrintData): Promise<void> => {
  const lines = buildReceiptLines(bill);

  // ── DEVELOPMENT MODE ──
  if (IS_EXPO_GO) {
    console.log("[BT] ═══════ SIMULATED RECEIPT ═══════");
    lines.forEach((line) => console.log("[BT]", line));
    console.log("[BT] ═══════════════════════════════");
    await new Promise((r) => setTimeout(r, 2000));
    return;
  }

  // ── PRODUCTION MODE ──
  try {
    const { BluetoothEscposPrinter } =
      require("react-native-bluetooth-escpos-printer") as typeof import("react-native-bluetooth-escpos-printer");

    // Shop name — large bold centered
    await BluetoothEscposPrinter.printerAlign(
      BluetoothEscposPrinter.ALIGN.CENTER
    );
    await BluetoothEscposPrinter.setBlob(0);
    await BluetoothEscposPrinter.printText(
      bill.shopName.toUpperCase() + "\n",
      { widthtimes: 1, heigthtimes: 1, fonttype: 1 }
    );

    // Reset to left align for details
    await BluetoothEscposPrinter.printerAlign(
      BluetoothEscposPrinter.ALIGN.LEFT
    );

    // Print each line
    for (const line of lines.slice(1)) {
      await BluetoothEscposPrinter.printText(line + "\n", {});
    }

    // Feed and cut
    await BluetoothEscposPrinter.printText("\n\n\n", {});

  } catch (error) {
    console.error("[BT] Print error:", error);
    throw new Error("Printing failed. Make sure printer is connected and has paper.");
  }
};

/**
 * Full flow: connect → print → done.
 * This is the main function called from bill-preview.tsx
 */
export const connectAndPrint = async (
  address:  string,
  bill:     BillPrintData,
  onStatus: (status: PrintStatus, message?: string) => void
): Promise<void> => {
  try {
    onStatus("connecting", "Connecting to printer...");
    await connectToPrinter(address);

    onStatus("printing", "Printing bill...");
    await printBill(bill);

    onStatus("success", "Bill printed successfully!");
  } catch (error: any) {
    onStatus("error", error.message || "Printing failed.");
    throw error;
  }
};
