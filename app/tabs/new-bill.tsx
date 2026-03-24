import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  TextInput,
  Animated,
  ScrollView,
  Pressable,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { db } from "../../firebase/firebaseConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { getUserId } from "../../utils/authStore";

/* ================================================================
   CONSTANTS & TYPES
================================================================ */
const { height } = Dimensions.get("window");
const CART_PANEL_HEIGHT = height * 0.54;

type CartItem = { id: string; name: string; price: number; quantity: number };
type Item     = { id: string; name: string; price: number };
type Category = { id: string; name: string };

/* ================================================================
   MEMOISED — ITEM CARD
   Re-renders only when this specific item's qty changes
================================================================ */
const ItemCard = memo(({
  item,
  qty,
  onAdd,
  onRemove,
}: {
  item: Item;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) => (
  <View style={styles.card}>
    <View style={styles.itemInfo}>
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemPrice}>
        ₹{Number(item.price).toLocaleString("en-IN")}
      </Text>
    </View>

    <View style={styles.counterContainer}>
      {qty > 0 && (
        <>
          <TouchableOpacity
            style={styles.minusBtn}
            onPress={onRemove}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={20} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{qty}</Text>
        </>
      )}
      <TouchableOpacity
        style={styles.plusBtn}
        onPress={onAdd}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  </View>
));

/* ================================================================
   MEMOISED — CART ROW
   Each row in the open cart panel
================================================================ */
const CartRow = memo(({
  item,
  onAdd,
  onRemove,
  onDelete,
}: {
  item: CartItem;
  onAdd: () => void;
  onRemove: () => void;
  onDelete: () => void;
}) => (
  <View style={styles.cartRow}>
    {/* Name + unit price */}
    <View style={styles.cartRowLeft}>
      <Text style={styles.cartItemName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.cartItemUnit}>
        ₹{Number(item.price).toLocaleString("en-IN")} each
      </Text>
    </View>

    {/* Qty stepper */}
    <View style={styles.cartStepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={onRemove}>
        <Ionicons name="remove" size={15} color="#64748B" />
      </TouchableOpacity>
      <Text style={styles.stepQty}>{item.quantity}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={onAdd}>
        <Ionicons name="add" size={15} color="#64748B" />
      </TouchableOpacity>
    </View>

    {/* Line total */}
    <Text style={styles.cartRowTotal}>
      ₹{Number(item.price * item.quantity).toLocaleString("en-IN")}
    </Text>

    {/* Full delete */}
    <TouchableOpacity
      style={styles.cartDeleteBtn}
      onPress={onDelete}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="trash-outline" size={16} color="#EF4444" />
    </TouchableOpacity>
  </View>
));

/* ================================================================
   MAIN COMPONENT
================================================================ */
export default function NewBill() {
  const router = useRouter();
  const params = useLocalSearchParams();

  /* ── State ── */
  const [uid, setUid]                           = useState<string | null>(null);
  const [categories, setCategories]             = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems]                       = useState<Item[]>([]);
  const [cart, setCart]                         = useState<Record<string, CartItem>>({});
  const [cartOpen, setCartOpen]                 = useState(false);
  const [searchQuery, setSearchQuery]           = useState("");
  const [allItems, setAllItems]                 = useState<Item[]>([]);

  /* ── Refs ── */
  const searchRef = useRef<TextInput>(null);
  const cartAnim  = useRef(new Animated.Value(0)).current;

  /* ── Derived ── */
  const isSearching = searchQuery.trim().length > 0;

  const searchResults = useMemo(
    () =>
      isSearching
        ? allItems.filter((i) =>
            i.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : items,
    [isSearching, allItems, items, searchQuery]
  );

  const cartItems = useMemo(() => Object.values(cart), [cart]);

  const total = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cartItems]
  );

  const cartCount = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
    [cartItems]
  );

  /* ================================================================
     CART ANIMATION
  ================================================================ */
  const openCart = useCallback(() => {
    Keyboard.dismiss();
    setCartOpen(true);
    Animated.spring(cartAnim, {
      toValue:         1,
      useNativeDriver: true,
      tension:         65,
      friction:        11,
    }).start();
  }, [cartAnim]);

  const closeCart = useCallback(() => {
    Animated.spring(cartAnim, {
      toValue:         0,
      useNativeDriver: true,
      tension:         65,
      friction:        11,
    }).start(() => setCartOpen(false));
  }, [cartAnim]);

  const toggleCart = useCallback(() => {
    cartOpen ? closeCart() : openCart();
  }, [cartOpen, openCart, closeCart]);

  /* ================================================================
     LIFECYCLE
  ================================================================ */

  // Fresh cart + closed panel on every tab focus (new customer)
  // But skip if we're restoring cart from bill-preview
  useFocusEffect(
    useCallback(() => {
      if (params.restoreCart) return; // coming back from preview — keep cart
      setCart({});
      setSearchQuery("");
      closeCart();
    }, [params.restoreCart])
  );

  // Safety net: clear after successful bill save
  useEffect(() => {
    if (params.clear === "true") {
      setCart({});
      setSearchQuery("");
      closeCart();
      router.setParams({ clear: "" });
    }
  }, [params.clear]);

  // Restore cart when coming back from bill-preview
  useEffect(() => {
    if (params.restoreCart) {
      try {
        const restored = JSON.parse(params.restoreCart as string);
        setCart(restored);
        router.setParams({ restoreCart: "" });
      } catch (_) {}
    }
  }, [params.restoreCart]);

  useEffect(() => { getUserId().then(setUid); }, []);

  // Categories listener
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, "users", uid, "categories"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setCategories(list);
        if (list.length > 0 && !selectedCategory) setSelectedCategory(list[0].id);
      }
    );
    return () => unsub();
  }, [uid]);

  // Items for selected category
  useEffect(() => {
    if (!uid || !selectedCategory) return;
    const unsub = onSnapshot(
      collection(db, "users", uid, "categories", selectedCategory, "items"),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      }
    );
    return () => unsub();
  }, [uid, selectedCategory]);

  // All items across all categories — for search
  useEffect(() => {
    if (!uid || categories.length === 0) return;
    const unsubList = categories.map((cat) =>
      onSnapshot(
        collection(db, "users", uid, "categories", cat.id, "items"),
        (snap) => {
          setAllItems((prev) => {
            const map = new Map(prev.map((i) => [i.id, i]));
            snap.docs.forEach((d) =>
              map.set(d.id, { id: d.id, ...(d.data() as any) })
            );
            return Array.from(map.values());
          });
        }
      )
    );
    return () => unsubList.forEach((u) => u());
  }, [uid, categories]);

  /* ================================================================
     CART OPERATIONS
  ================================================================ */
  const addItem = useCallback((item: Item) => {
    setCart((prev) => ({
      ...prev,
      [item.id]: {
        id:       item.id,
        name:     item.name,
        price:    item.price,
        quantity: (prev[item.id]?.quantity || 0) + 1,
      },
    }));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => {
      if (!prev[itemId]) return prev;
      const qty = prev[itemId].quantity - 1;
      if (qty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        if (Object.keys(next).length === 0) closeCart();
        return next;
      }
      return { ...prev, [itemId]: { ...prev[itemId], quantity: qty } };
    });
  }, [closeCart]);

  // Removes entire item regardless of quantity
  const deleteFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      if (Object.keys(next).length === 0) closeCart();
      return next;
    });
  }, [closeCart]);

  const proceedToPreview = useCallback(() => {
    router.push({
      pathname: "/tabs/bill-preview",
      params:   { cart: JSON.stringify(cart) },
    });
  }, [cart, router]);

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <View style={styles.container}>

      {/* ══════════════════════════════════
          HEADER — Search + Categories
      ══════════════════════════════════ */}
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>

        {/* Title row */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Bill</Text>
          {/* Cart count pill — quick glance */}
          {cartCount > 0 && (
            <TouchableOpacity style={styles.headerCartPill} onPress={toggleCart}>
              <Ionicons name="cart-outline" size={16} color="#2563EB" />
              <Text style={styles.headerCartCount}>{cartCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            ref={searchRef}
            placeholder="Search items across all categories..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(""); searchRef.current?.blur(); }}
              style={styles.searchClearBtn}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category pills — hidden while searching */}
        {!isSearching ? (
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
                    style={[styles.categoryTab, isActive && styles.categoryActive]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                      {item.name}
                    </Text>
                    {isActive && <View style={styles.activeDot} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : (
          /* Search result count bar */
          <View style={styles.searchModeBar}>
            <Ionicons name="grid-outline" size={14} color="#2563EB" />
            <Text style={styles.searchModeText}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} across all categories
            </Text>
          </View>
        )}

      </SafeAreaView>

      {/* ══════════════════════════════════
          ITEM LIST
      ══════════════════════════════════ */}
      <FlatList
        data={searchResults}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[
          styles.listContent,
          cartCount > 0 && { paddingBottom: 110 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={isSearching ? "search-outline" : "fast-food-outline"}
              size={64}
              color="#E2E8F0"
            />
            <Text style={styles.emptyTitle}>
              {isSearching ? `No results for "${searchQuery}"` : "No items here"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isSearching ? "Try a different keyword" : "Add items from the Menu screen"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            qty={cart[item.id]?.quantity || 0}
            onAdd={() => addItem(item)}
            onRemove={() => removeItem(item.id)}
          />
        )}
      />

      {/* ══════════════════════════════════
          CART PANEL — slides up from bottom
      ══════════════════════════════════ */}
      {cartCount > 0 && (
        <>
          {/* Backdrop — closes cart on tap */}
          {cartOpen && (
            <Animated.View
              style={[
                styles.backdrop,
                {
                  opacity: cartAnim.interpolate({
                    inputRange:  [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ]}
              pointerEvents="box-only"
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={closeCart} />
            </Animated.View>
          )}

          {/* Animated panel */}
          <Animated.View
            style={[
              styles.cartPanel,
              {
                transform: [
                  {
                    translateY: cartAnim.interpolate({
                      inputRange:  [0, 1],
                      outputRange: [CART_PANEL_HEIGHT - 90, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* ── Handle + collapsed summary ── */}
            <TouchableOpacity
              style={styles.cartHandle}
              onPress={toggleCart}
              activeOpacity={0.9}
            >
              {/* Drag pill */}
              <View style={styles.handlePill} />

              <View style={styles.cartHandleRow}>
                {/* Left: cart icon with badge */}
                <View style={styles.cartIconWrap}>
                  <Ionicons name="cart" size={20} color="#fff" />
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount}</Text>
                  </View>
                </View>

                {/* Middle: title + subtitle stacked vertically */}
                <View style={styles.cartHandleMiddle}>
                  <Text style={styles.cartHandleTitle}>Your Cart</Text>
                  <Text style={styles.cartHandleSub} numberOfLines={1}>
                    {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
                    {!cartOpen ? " · tap to review" : " · tap to close"}
                  </Text>
                </View>

                {/* Right: total amount + compact proceed button */}
                <View style={styles.cartHandleRight}>
                  <Text style={styles.cartHandleTotal}>
                    ₹{total.toLocaleString("en-IN")}
                  </Text>
                  {!cartOpen && (
                    <TouchableOpacity
                      style={styles.proceedBtn}
                      onPress={proceedToPreview}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.proceedText}>Proceed</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* ── Expanded cart content ── */}
            {cartOpen && (
              <>
                {/* Column headers */}
                <View style={styles.cartTableHead}>
                  <Text style={[styles.cartHeadText, { flex: 1 }]}>ITEM</Text>
                  <Text style={[styles.cartHeadText, { width: 96, textAlign: "center" }]}>QTY</Text>
                  <Text style={[styles.cartHeadText, { width: 68, textAlign: "right" }]}>TOTAL</Text>
                  <View style={{ width: 34 }} />
                </View>

                {/* Scrollable rows */}
                <ScrollView
                  style={styles.cartScroll}
                  contentContainerStyle={styles.cartScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {cartItems.map((item) => (
                    <CartRow
                      key={item.id}
                      item={item}
                      onAdd={() => addItem(item)}
                      onRemove={() => removeItem(item.id)}
                      onDelete={() => deleteFromCart(item.id)}
                    />
                  ))}
                </ScrollView>

                {/* Grand total + confirm */}
                <View style={styles.cartFooter}>
                  <View>
                    <Text style={styles.cartFooterLabel}>GRAND TOTAL</Text>
                    <Text style={styles.cartFooterTotal}>
                      ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={proceedToPreview}
                  >
                    <Text style={styles.confirmText}>Confirm & Proceed</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </>
      )}

    </View>
  );
}

/* ================================================================
   STYLES
================================================================ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  /* ── Header ── */
  headerSafe: {
    backgroundColor:  "#FFFFFF",
    zIndex:           10,
    shadowColor:      "#000",
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.05,
    shadowRadius:     10,
    elevation:        4,
  },
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  headerTitle: {
    fontSize:      22,
    fontWeight:    "800",
    color:         "#0F172A",
    letterSpacing: -0.3,
  },
  headerCartPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       "#DBEAFE",
  },
  headerCartCount: {
    fontSize:   13,
    fontWeight: "700",
    color:      "#2563EB",
  },

  /* ── Search ── */
  searchContainer: {
    flexDirection:     "row",
    alignItems:        "center",
    marginHorizontal:  16,
    marginBottom:      12,
    backgroundColor:   "#F1F5F9",
    borderRadius:      14,
    borderWidth:       1.5,
    borderColor:       "#E2E8F0",
    paddingHorizontal: 12,
    height:            46,
  },
  searchIcon:     { marginRight: 8 },
  searchInput:    { flex: 1, fontSize: 14, color: "#0F172A", fontWeight: "500" },
  searchClearBtn: { padding: 4 },
  searchModeBar: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 16,
    paddingBottom:     12,
  },
  searchModeText: { fontSize: 13, color: "#2563EB", fontWeight: "600" },

  /* ── Categories ── */
  categoryContainer: {
    paddingBottom:     14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  categoryListContent: { paddingHorizontal: 16, gap: 8 },
  categoryTab: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   9,
    paddingHorizontal: 20,
    borderRadius:      100,
    backgroundColor:   "#F1F5F9",
    borderWidth:       1.5,
    borderColor:       "#E2E8F0",
    gap:               6,
  },
  categoryActive: {
    backgroundColor: "#2563EB",
    borderColor:     "#2563EB",
    shadowColor:     "#2563EB",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    8,
    elevation:       6,
  },
  categoryText:       { fontSize: 14, fontWeight: "600", color: "#94A3B8", letterSpacing: 0.2 },
  categoryTextActive: { color: "#FFFFFF", fontWeight: "700" },
  activeDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  /* ── Item list ── */
  listContent: { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius:    16,
    padding:         16,
    marginBottom:    12,
    shadowColor:     "#64748B",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.06,
    shadowRadius:    12,
    elevation:       2,
    borderWidth:     1,
    borderColor:     "#F8FAFC",
  },
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: 16, fontWeight: "600", color: "#1E293B", marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: "700", color: "#2563EB" },

  /* ── Counter ── */
  counterContainer: { flexDirection: "row", alignItems: "center", gap: 12 },
  minusBtn: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: "#F1F5F9",
    alignItems:      "center",
    justifyContent:  "center",
  },
  qtyText: {
    fontSize:   16,
    fontWeight: "700",
    color:      "#0F172A",
    minWidth:   20,
    textAlign:  "center",
  },
  plusBtn: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: "#2563EB",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#2563EB",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.25,
    shadowRadius:    8,
    elevation:       4,
  },

  /* ── Empty state ── */
  emptyState:    { alignItems: "center", marginTop: 80 },
  emptyTitle:    { marginTop: 16, fontSize: 17, fontWeight: "700", color: "#94A3B8" },
  emptySubtitle: { marginTop: 6, fontSize: 13, color: "#CBD5E1", textAlign: "center" },

  /* ── Backdrop ── */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    zIndex:          20,
  },

  /* ── Cart panel ── */
  cartPanel: {
    position:              "absolute",
    bottom:                0,
    left:                  0,
    right:                 0,
    height:                CART_PANEL_HEIGHT,
    backgroundColor:       "#FFFFFF",
    borderTopLeftRadius:   26,
    borderTopRightRadius:  26,
    zIndex:                30,
    shadowColor:           "#000",
    shadowOffset:          { width: 0, height: -6 },
    shadowOpacity:         0.12,
    shadowRadius:          20,
    elevation:             24,
  },

  /* ── Cart handle (always visible) ── */
  cartHandle: {
    paddingHorizontal: 18,
    paddingBottom:     14,
  },
  handlePill: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: "#E2E8F0",
    alignSelf:       "center",
    marginTop:       12,
    marginBottom:    14,
  },
  cartHandleRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            12,
    marginBottom:   12,
  },
  /* Cart icon with red badge */
  cartIconWrap: {
    width:           46,
    height:          46,
    borderRadius:    14,
    backgroundColor: "#2563EB",
    alignItems:      "center",
    justifyContent:  "center",
  },
  cartBadge: {
    position:          "absolute",
    top:               -5,
    right:             -5,
    backgroundColor:   "#EF4444",
    borderRadius:      10,
    minWidth:          18,
    height:            18,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 3,
    borderWidth:       2,
    borderColor:       "#fff",
  },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  /* Middle section takes all remaining space */
  cartHandleMiddle: {
    flex: 1,
  },
  cartHandleTitle:  { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  cartHandleSub:    { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  cartHandleTotal:  { fontSize: 17, fontWeight: "800", color: "#0F172A" },

  /* Right column: total + compact proceed button stacked */
  cartHandleRight: {
    alignItems:  "flex-end",
    gap:         6,
  },

  /* Compact inline proceed button */
  proceedBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   "#2563EB",
    paddingVertical:   7,
    paddingHorizontal: 12,
    borderRadius:      10,
    shadowColor:       "#2563EB",
    shadowOffset:      { width: 0, height: 3 },
    shadowOpacity:     0.28,
    shadowRadius:      6,
    elevation:         4,
  },
  proceedText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  /* ── Expanded cart ── */
  cartTableHead: {
    flexDirection:      "row",
    alignItems:         "center",
    paddingHorizontal:  18,
    paddingVertical:    8,
    borderTopWidth:     1,
    borderBottomWidth:  1,
    borderColor:        "#F1F5F9",
    backgroundColor:    "#FAFAFA",
  },
  cartHeadText: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.8 },

  cartScroll:        { flex: 1 },
  cartScrollContent: { paddingHorizontal: 18, paddingBottom: 8 },

  /* Cart row */
  cartRow: {
    flexDirection:    "row",
    alignItems:       "center",
    paddingVertical:  13,
    borderBottomWidth:1,
    borderBottomColor:"#F8FAFC",
    gap:              6,
  },
  cartRowLeft:   { flex: 1 },
  cartItemName:  { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  cartItemUnit:  { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  cartStepper: {
    flexDirection:  "row",
    alignItems:     "center",
    width:          96,
    justifyContent: "center",
    gap:            8,
  },
  stepBtn: {
    width:           28,
    height:          28,
    borderRadius:    8,
    backgroundColor: "#F1F5F9",
    alignItems:      "center",
    justifyContent:  "center",
  },
  stepQty: {
    fontSize:   14,
    fontWeight: "700",
    color:      "#0F172A",
    minWidth:   18,
    textAlign:  "center",
  },
  cartRowTotal:  { width: 68, fontSize: 14, fontWeight: "700", color: "#0F172A", textAlign: "right" },
  cartDeleteBtn: { width: 34, alignItems: "center" },

  /* Cart footer */
  cartFooter: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 18,
    paddingVertical:   16,
    borderTopWidth:    1,
    borderTopColor:    "#F1F5F9",
    backgroundColor:   "#FFFFFF",
  },
  cartFooterLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", letterSpacing: 0.6 },
  cartFooterTotal: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 2 },

  confirmBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    backgroundColor:   "#2563EB",
    paddingVertical:   14,
    paddingHorizontal: 20,
    borderRadius:      16,
    shadowColor:       "#2563EB",
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.3,
    shadowRadius:      10,
    elevation:         8,
  },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});