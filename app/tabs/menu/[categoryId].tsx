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
} from "react-native";
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
} from "firebase/firestore";
import { getUserId } from "../../../utils/authStore";

export default function CategoryItems() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams();

  const [uid, setUid] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("Category");
  const [items, setItems] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");

  // ---------------- LOAD USER & CATEGORY ----------------
  useEffect(() => {
    getUserId().then(setUid);
  }, []);

  useEffect(() => {
    if (!uid || !categoryId) return;

    // Fetch category name
    const catRef = doc(db, "users", uid, "categories", String(categoryId));
    getDoc(catRef).then((snap) => {
      if (snap.exists()) {
        setCategoryName(snap.data().name);
      }
    });

    // Listen to items
    const itemsRef = collection(
      db,
      "users",
      uid,
      "categories",
      String(categoryId),
      "items"
    );

    const unsub = onSnapshot(itemsRef, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setItems(list);
    });

    return unsub;
  }, [uid, categoryId]);

  // ---------------- ADD ITEM ----------------
  const addItem = async () => {
    if (!itemName || !price) {
      Alert.alert("Error", "Enter item name & price");
      return;
    }

    await addDoc(
      collection(
        db,
        "users",
        uid!,
        "categories",
        String(categoryId),
        "items"
      ),
      {
        name: itemName,
        price: Number(price),
        createdAt: Date.now(),
      }
    );

    setItemName("");
    setPrice("");
    setShowModal(false);
  };

  // ---------------- DELETE ITEM ----------------
  const deleteItem = (itemId: string) => {
    Alert.alert("Delete Item?", "This cannot be undone", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(
            doc(
              db,
              "users",
              uid!,
              "categories",
              String(categoryId),
              "items",
              itemId
            )
          );
        },
      },
    ]);
  };

  // ---------------- UI ----------------
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.title}>{categoryName}</Text>

        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Ionicons name="add-circle" size={30} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* EMPTY STATE */}
      {items.length === 0 && (
        <Text style={styles.emptyText}>No items added yet</Text>
      )}

      {/* ITEMS LIST */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>

            <TouchableOpacity onPress={() => deleteItem(item.id)}>
              <Ionicons name="trash" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* ADD ITEM MODAL */}
      <Modal transparent animationType="slide" visible={showModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Item</Text>

            <TextInput
              placeholder="Item name"
              placeholderTextColor="#000"
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
            />

            <TextInput
              placeholder="Price"
              placeholderTextColor="#000"
              style={styles.input}
              keyboardType="number-pad"
              value={price}
              onChangeText={setPrice}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={addItem}>
                <Text style={styles.save}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },

  title: { fontSize: 18, fontWeight: "700", color: "#0F172A" },

  emptyText: {
    marginTop: 40,
    textAlign: "center",
    color: "#6B7280",
  },

  itemCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemName: { fontSize: 16, fontWeight: "600" },
  itemPrice: { marginTop: 4, color: "#2563EB", fontWeight: "700" },

  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  modalCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    color: "#000",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 20,
  },

  cancel: { color: "#6B7280", fontSize: 16 },
  save: { color: "#2563EB", fontSize: 16, fontWeight: "700" },
});
