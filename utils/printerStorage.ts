import AsyncStorage from "@react-native-async-storage/async-storage";

export type PrinterDevice = {
  name: string;
  address: string;
};

const PRINTER_STORAGE_KEY = "savedPrinter";

export const getSavedPrinter = async (): Promise<PrinterDevice | null> => {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const savePrinterToStorage = async (
  printer: PrinterDevice
): Promise<void> => {
  await AsyncStorage.setItem(
    PRINTER_STORAGE_KEY,
    JSON.stringify(printer)
  );
};

export const clearSavedPrinter = async (): Promise<void> => {
  await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
};