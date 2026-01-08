import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { db } from "../../firebase/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { getUserId } from "../../utils/authStore";

/* ---------------- TYPES ---------------- */
type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type Item = {
  id: string;
  name: string;
  price: number;
};

type Category = {
  id: string;
  name: string;
};

const { width } = Dimensions.get("window");

export default function NewBill() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [uid, setUid] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<Record<string, CartItem>>({});

  /* ---------------- LOGIC ---------------- */
  
  // Clear cart if returning from a successful bill save
  useEffect(() => {
    if (params.clear === "true") {
      setCart({});
      router.setParams({ clear: "" });
    }
  }, [params.clear]);

  useEffect(() => {
    getUserId().then(setUid);
  }, []);

  // Load Categories
  useEffect(() => {
    if (!uid) return;
    const ref = collection(db, "users", uid, "categories");
    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setCategories(list);
      if (!selectedCategory && list.length > 0) {
        setSelectedCategory(list[0].id);
      }
    });
    return unsub;
  }, [uid]);

  // Load Items based on Category
  useEffect(() => {
    if (!uid || !selectedCategory) return;
    const ref = collection(
      db,
      "users",
      uid,
      "categories",
      selectedCategory,
      "items"
    );
    const unsub = onSnapshot(ref, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });
    return unsub;
  }, [uid, selectedCategory]);

  // Cart Operations
  const addItem = (item: Item) => {
    setCart((prev) => {
      const existing = prev[item.id];
      const newQty = (existing?.quantity || 0) + 1;
      return {
        ...prev,
        [item.id]: {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: newQty,
        },
      };
    });
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const newQty = existing.quantity - 1;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: newQty },
      };
    });
  };

  const total = Object.values(cart).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const cartCount = Object.values(cart).reduce(
    (sum, item) => sum + item.quantity, 
    0
  );

  /* ---------------- RENDER ---------------- */
  return (
    <View style={styles.container}>
      {/* 1. PROFESSIONAL HEADER */}
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Bill</Text>
          <View style={styles.placeholderIcon} /> 
          {/* Empty view to balance the header title center alignment if needed */}
        </View>

        {/* Categories Tab Bar */}
        <View style={styles.categoryContainer}>
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.categoryListContent}
            renderItem={({ item }) => {
              const isActive = selectedCategory === item.id;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedCategory(item.id)}
                  style={[
                    styles.categoryTab,
                    isActive && styles.categoryActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      isActive && styles.categoryTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </SafeAreaView>

      {/* 2. MENU ITEMS LIST */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        // Add padding at bottom so last item isn't hidden behind footer
        contentContainerStyle={styles.listContent} 
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="fast-food-outline" size={64} color="#E2E8F0" />
            <Text style={styles.emptyText}>No items in this category</Text>
          </View>
        }
        renderItem={({ item }) => {
          const qty = cart[item.id]?.quantity || 0;
          return (
            <View style={styles.card}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>

              {/* Counter Logic */}
              <View style={styles.counterContainer}>
                {qty > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.minusBtn}
                      onPress={() => removeItem(item.id)}
                    >
                      <Ionicons name="remove" size={20} color="#64748B" />
                    </TouchableOpacity>
                    
                    <Text style={styles.qtyText}>{qty}</Text>
                  </>
                )}

                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={() => addItem(item)}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* 3. COMPACT FOOTER */}
      {/* Only show footer if there is at least 1 item in cart */}
      <View style={styles.footerContainer}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total ({cartCount} items)</Text>
          <Text style={styles.totalValue}>₹{total}</Text>
        </View>

        <TouchableOpacity
          disabled={total === 0}
          style={[
            styles.proceedBtn,
            total === 0 && styles.disabledBtn,
          ]}
          onPress={() =>
            router.push({
              pathname: "/tabs/bill-preview",
              params: { cart: JSON.stringify(cart) },
            })
          }
        >
          <Text style={styles.proceedText}>Proceed</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC", // Light Gray Background
  },

  /* HEADER */
  headerSafe: {
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    // Soft shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    padding: 8,
    marginLeft: -8,
  },
  placeholderIcon: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.5,
  },

  /* CATEGORIES */
  categoryContainer: {
    paddingBottom: 12,
  },
  categoryListContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 100, // Pill Shape
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryActive: {
    backgroundColor: "#2563EB", // Primary Blue
    borderColor: "#2563EB",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },

  /* LIST ITEMS */
  listContent: {
    padding: 16,
    paddingBottom: 100, // Important: Space for the footer
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // Card Shadow
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F8FAFC",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563EB",
  },

  /* COUNTER BUTTONS */
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  minusBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    minWidth: 20,
    textAlign: "center",
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#2563EB", // Primary Blue - Pops out from background
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  /* EMPTY STATE */
  emptyState: {
    alignItems: "center",
    marginTop: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#94A3B8",
    fontWeight: "500",
  },

  /* FOOTER */
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    // Top Shadow to separate from list
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  totalSection: {
    flexDirection: "column",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  proceedBtn: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  disabledBtn: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  proceedText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});