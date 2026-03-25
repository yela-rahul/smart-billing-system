declare module "react-native-bluetooth-escpos-printer" {
  export const BluetoothManager: {
    enableBluetooth(): Promise<void>;
    scanDevices(): Promise<string>;
    connect(address: string): Promise<void>;
    disconnect(): Promise<void>;
    isBluetoothEnabled(): Promise<boolean>;
  };

  export const BluetoothEscposPrinter: {
    ALIGN: {
      LEFT: number;
      CENTER: number;
      RIGHT: number;
    };
    printerAlign(align: number): Promise<void>;
    setBlob(blob: number): Promise<void>;
    printText(text: string, options: {
      widthtimes?: number;
      heigthtimes?: number;
      fonttype?: number;
    }): Promise<void>;
    printColumn(
      columnWidths: number[],
      columnAligns: number[],
      columnTexts: string[],
      options?: object
    ): Promise<void>;
    printPic(base64: string, options?: object): Promise<void>;
    selfTest(): Promise<void>;
    cutOnePoint(): Promise<void>;
  };

  export const BluetoothTscPrinter: {
    printLabel(options: object): Promise<void>;
  };
}