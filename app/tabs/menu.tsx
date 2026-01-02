import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useRouter } from "expo-router";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { getUserId } from "../../utils/authStore";

/* ---------- ICON TYPE SAFETY ---------- */
type IconName = ComponentProps<typeof Ionicons>["name"];

const ICONS: IconName[] = [
  "fast-food",
  "cafe",
  "pizza",
  "wine",
  "ice-cream",
  "restaurant",
];

export default function Menu() {
  const router = useRouter();

  const [categories, setCategories] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [icon, setIcon] = useState<IconName>("fast-food");

  /* ---------- LOAD CATEGORIES ---------- */
  useEffect(() => {
    let unsubscribe: any;

    const loadCategories = async () => {
      const uid = await getUserId();
      if (!uid) return;

      const ref = collection(db, "users", uid, "categories");

      unsubscribe = onSnapshot(ref, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) =>
          list.push({ id: doc.id, ...doc.data() })
        );
        setCategories(list);
      });
    };

    loadCategories();
    return () => unsubscribe && unsubscribe();
  }, []);

  /* ---------- ADD CATEGORY ---------- */
  const addCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert("Error", "Category name required");
      return;
    }

    const uid = await getUserId();
    if (!uid) return;

    await addDoc(collection(db, "users", uid, "categories"), {
      name: categoryName,
      icon,
      createdAt: new Date(),
    });

    setCategoryName("");
    setIcon("fast-food");
    setModalVisible(false);
  };

  /* ---------- DELETE CATEGORY ---------- */
  const deleteCategory = async (id: string) => {
    const uid = await getUserId();
    if (!uid) return;

    Alert.alert("Delete Category", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "users", uid, "categories", id));
        },
      },
    ]);
  };

  /* ---------- UI ---------- */
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={32} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* CATEGORY LIST */}
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/tabs/menu/[categoryId]",
                params: { categoryId: item.id },
              })
            }
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name={item.icon as IconName}
                size={22}
                color="#2563EB"
              />
              <Text style={styles.cardText}>{item.name}</Text>
            </View>

            <TouchableOpacity onPress={() => deleteCategory(item.id)}>
              <Ionicons name="trash" size={20} color="#EF4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* ADD CATEGORY MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Category</Text>

            <TextInput
              placeholder="Category name"
              value={categoryName}
              onChangeText={setCategoryName}
              style={styles.input}
            />

            <View style={styles.iconRow}>
              {ICONS.map((ic) => (
                <TouchableOpacity key={ic} onPress={() => setIcon(ic)}>
                  <Ionicons
                    name={ic}
                    size={26}
                    color={icon === ic ? "#2563EB" : "#94A3B8"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={addCategory}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: { fontSize: 22, fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  cardText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },

  iconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  saveBtn: {
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  saveText: { color: "#fff", fontWeight: "700" },

  cancel: {
    textAlign: "center",
    marginTop: 10,
    color: "#64748B",
  },
});
