import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";

import { db } from "../../../firebase/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { getUserId } from "../../../utils/authStore";

/* ---------------- TYPES ---------------- */
type Item = {
  id: string;
  name: string;
  price: number;
};

/* ---------------- MODAL MODE ---------------- */
type ModalMode = "add" | "edit";

export default function CategoryItems() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams();

  const [uid, setUid]                   = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("Category");
  const [items, setItems]               = useState<Item[]>([]);

  // Modal state
  const [showModal, setShowModal]       = useState(false);
  const [modalMode, setModalMode]       = useState<ModalMode>("add");
  const [editingItem, setEditingItem]   = useState<Item | null>(null);
  const [itemName, setItemName]         = useState("");
  const [price, setPrice]               = useState("");
  const [saving, setSaving]             = useState(false);

  // ---------------- LOAD ----------------
  useEffect(() => { getUserId().then(setUid); }, []);

  useEffect(() => {
    if (!uid || !categoryId) return;

    // Category name
    getDoc(doc(db, "users", uid, "categories", String(categoryId))).then((snap) => {
      if (snap.exists()) setCategoryName(snap.data().name);
    });

    // Live items listener
    const unsub = onSnapshot(
      collection(db, "users", uid, "categories", String(categoryId), "items"),
      (snap) => {
        const list: Item[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          price: d.data().price,
        }));
        // Sort by name for consistent order
        list.sort((a, b) => a.name.localeCompare(b.name));
        setItems(list);
      }
    );
    return unsub;
  }, [uid, categoryId]);

  // ---------------- OPEN ADD MODAL ----------------
  const openAddModal = () => {
    setModalMode("add");
    setEditingItem(null);
    setItemName("");
    setPrice("");
    setShowModal(true);
  };

  // ---------------- OPEN EDIT MODAL ----------------
  const openEditModal = (item: Item) => {
    setModalMode("edit");
    setEditingItem(item);
    setItemName(item.name);
    setPrice(String(item.price));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setItemName("");
    setPrice("");
    setEditingItem(null);
  };

  // ---------------- VALIDATE ----------------
  const validate = (): boolean => {
    if (!itemName.trim()) {
      Alert.alert("Missing Name", "Please enter an item name.");
      return false;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price.");
      return false;
    }
    return true;
  };

  // ---------------- ADD ITEM ----------------
  const addItem = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await addDoc(
        collection(db, "users", uid!, "categories", String(categoryId), "items"),
        { name: itemName.trim(), price: Number(price), createdAt: Date.now() }
      );
      closeModal();
    } catch (e) {
      Alert.alert("Error", "Failed to add item. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- EDIT ITEM ----------------
  const saveEdit = async () => {
    if (!validate() || !editingItem) return;
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "users", uid!, "categories", String(categoryId), "items", editingItem.id),
        { name: itemName.trim(), price: Number(price) }
      );
      closeModal();
    } catch (e) {
      Alert.alert("Error", "Failed to update item. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- DELETE ITEM ----------------
  const deleteItem = (itemId: string, itemName: string) => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${itemName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(
              doc(db, "users", uid!, "categories", String(categoryId), "items", itemId)
            );
          },
        },
      ]
    );
  };

  // ---------------- UI ----------------
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/tabs/menu")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.title}>{categoryName}</Text>

        <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ITEM COUNT */}
      {items.length > 0 && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>{items.length} items</Text>
        </View>
      )}

      {/* EMPTY STATE */}
      {items.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="fast-food-outline" size={56} color="#E2E8F0" />
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptySubtitle}>Tap the + button to add your first item</Text>
        </View>
      )}

      {/* ITEMS LIST */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>

            {/* Left — name & price */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>
                ₹{Number(item.price).toLocaleString("en-IN")}
              </Text>
            </View>

            {/* Right — edit & delete buttons */}
            <View style={styles.itemActions}>

              {/* EDIT BUTTON */}
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => openEditModal(item)}
              >
                <Ionicons name="create-outline" size={18} color="#2563EB" />
              </TouchableOpacity>

              {/* DELETE BUTTON */}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteItem(item.id, item.name)}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>

            </View>
          </View>
        )}
      />

      {/* ── ADD / EDIT MODAL ── */}
      <Modal transparent animationType="slide" visible={showModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === "add" ? "Add New Item" : "Edit Item"}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Item Name */}
            <Text style={styles.inputLabel}>Item Name</Text>
            <TextInput
              placeholder="e.g. Masala Dosa"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
              autoFocus={showModal}
            />

            {/* Price */}
            <Text style={styles.inputLabel}>Price (₹)</Text>
            <TextInput
              placeholder="e.g. 80"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              keyboardType="number-pad"
              value={price}
              onChangeText={setPrice}
            />

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={modalMode === "add" ? addItem : saveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveText}>
                    {modalMode === "add" ? "Add Item" : "Save Changes"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  /* Header */
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    padding:           16,
    backgroundColor:   "#fff",
    borderBottomWidth: 1,
    borderColor:       "#E2E8F0",
  },
  backBtn: {
    width:          40,
    height:         40,
    borderRadius:   12,
    backgroundColor:"#F1F5F9",
    alignItems:     "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  addBtn: {
    width:          40,
    height:         40,
    borderRadius:   12,
    backgroundColor:"#2563EB",
    alignItems:     "center",
    justifyContent: "center",
  },

  /* Count bar */
  countBar: {
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  countText: { fontSize: 13, color: "#64748B", fontWeight: "600" },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },

  /* Item card */
  itemCard: {
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
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  itemPrice: { marginTop: 4, color: "#2563EB", fontWeight: "700", fontSize: 15 },

  /* Edit & Delete buttons */
  itemActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBtn: {
    width:          36,
    height:         36,
    borderRadius:   10,
    backgroundColor:"#EFF6FF",
    alignItems:     "center",
    justifyContent: "center",
  },
  deleteBtn: {
    width:          36,
    height:         36,
    borderRadius:   10,
    backgroundColor:"#FEF2F2",
    alignItems:     "center",
    justifyContent: "center",
  },

  /* Empty state */
  emptyState: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      80,
  },
  emptyTitle:    { marginTop: 16, fontSize: 18, fontWeight: "700", color: "#94A3B8" },
  emptySubtitle: { marginTop: 8, fontSize: 14, color: "#CBD5E1", textAlign: "center", paddingHorizontal: 40 },

  /* Modal */
  modalWrap: {
    flex:            1,
    justifyContent:  "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    backgroundColor:     "#fff",
    padding:             20,
    borderTopLeftRadius: 24,
    borderTopRightRadius:24,
    paddingBottom:       36,
  },
  modalHeader: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   20,
  },
  modalTitle:    { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  modalCloseBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    backgroundColor:"#F1F5F9",
    alignItems:     "center",
    justifyContent: "center",
  },

  inputLabel: {
    fontSize:    13,
    fontWeight:  "600",
    color:       "#475569",
    marginTop:   14,
    marginBottom: 6,
  },
  input: {
    borderWidth:  1,
    borderColor:  "#E2E8F0",
    borderRadius: 12,
    padding:      14,
    fontSize:     15,
    color:        "#0F172A",
    backgroundColor:"#F8FAFC",
  },

  modalActions: {
    flexDirection: "row",
    gap:           12,
    marginTop:     24,
  },
  cancelBtn: {
    flex:           1,
    paddingVertical:14,
    borderRadius:   12,
    alignItems:     "center",
    backgroundColor:"#F1F5F9",
  },
  cancelText: { color: "#64748B", fontWeight: "600", fontSize: 15 },

  saveBtn: {
    flex:           1,
    paddingVertical:14,
    borderRadius:   12,
    alignItems:     "center",
    backgroundColor:"#2563EB",
  },
  saveBtnDisabled: { backgroundColor: "#93C5FD" },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});