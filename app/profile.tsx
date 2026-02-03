import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebaseConfig";
import { clearAuth } from "../utils/authStore";

export default function Profile() {
  const router = useRouter();

  /* ====================================================================
     LOGIC SECTION (UNCHANGED)
     ==================================================================== */
  const BG = "#F8FAFC"; // Updated variable, though we use styles mostly
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");

  const [pwdModal, setPwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");

  /* LOAD PROFILE */
  useEffect(() => {
    const load = async () => {
      try {
        const uid = auth.currentUser?.uid;

        if (!uid) {
          setLoading(false);
          return;
        }

        const snap = await getDoc(doc(db, "users", uid));

        if (snap.exists()) {
          const d = snap.data();
          setUser(d);
          setFullName(d.fullName || "");
          setShopName(d.shopName || "");
          setPhone(d.phone || "");
        }
      } catch (err) {
        Alert.alert("Error", "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* SAVE PROFILE */
  const saveProfile = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      await updateDoc(doc(db, "users", uid), {
        fullName,
        shopName,
        phone,
      });

      setUser((prev: any) => ({
        ...prev,
        fullName,
        shopName,
        phone,
      }));

      setEditVisible(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err) {
      Alert.alert("Error", "Failed to update profile.");
    }
  };

  /* CHANGE PASSWORD */
  const changePassword = async () => {
    try {
      const userAuth = auth.currentUser;
      if (!userAuth || !userAuth.email) return;

      if (!oldPwd || !newPwd) {
        Alert.alert("Error", "Please enter both old and new password.");
        return;
      }

      if (newPwd.length < 6) {
        Alert.alert("Error", "New password must be at least 6 characters.");
        return;
      }

      const cred = EmailAuthProvider.credential(userAuth.email, oldPwd);

      await reauthenticateWithCredential(userAuth, cred);
      await updatePassword(userAuth, newPwd);

      Alert.alert("Success", "Password changed successfully!");
      setPwdModal(false);
      setOldPwd("");
      setNewPwd("");
    } catch (err) {
      Alert.alert("Error", "Old password incorrect or too many attempts.");
    }
  };

  /* LOGOUT */
  const logout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            const uid = auth.currentUser?.uid;

            if (uid) {
              await updateDoc(doc(db, "users", uid), {
                lastLogout: new Date().toISOString(),
              });
            }

            await signOut(auth);
            await clearAuth();
            router.replace("/auth/login");
          } catch (err) {
            Alert.alert("Error", "Logout failed. Try again.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  /* ====================================================================
     UI SECTION (PROFESSIONAL REDESIGN)
     ==================================================================== */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* CUSTOM HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. HERO PROFILE CARD (Blue Theme) */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={28} color="#2563EB" />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroWelcome}>Welcome,</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {user?.fullName || "User Name"}
              </Text>
              <Text style={styles.heroShop}>{user?.shopName || "Shop Name"}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => setEditVisible(true)}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
            <Ionicons name="create-outline" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* 2. CONTACT GRID (Mimicking 'Orders' & 'Items' cards) */}
        <View style={styles.gridContainer}>
          {/* Card 1: Phone */}
          <View style={styles.gridCard}>
            <View style={[styles.iconBox, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="call" size={20} color="#2563EB" />
            </View>
            <Text style={styles.gridValue}>{user?.phone || "N/A"}</Text>
            <Text style={styles.gridLabel}>Contact</Text>
          </View>

          {/* Card 2: Shop Details */}
          <View style={styles.gridCard}>
            <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="storefront" size={20} color="#D97706" />
            </View>
            <Text style={styles.gridValue} numberOfLines={1}>
              {user?.shopName || "N/A"}
            </Text>
            <Text style={styles.gridLabel}>Store Name</Text>
          </View>
        </View>

        {/* 3. SETTINGS LIST (Mimicking 'Recent Bills' List) */}
        <Text style={styles.sectionTitle}>Account & Security</Text>

        <TouchableOpacity
          style={styles.listItem}
          onPress={() => setPwdModal(true)}
        >
          <View style={styles.listLeft}>
            <View style={styles.listIconBox}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#475569" />
            </View>
            <View>
              <Text style={styles.listTitle}>Change Password</Text>
              <Text style={styles.listSub}>Update your login info</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>

        <View style={styles.listItem}>
          <View style={styles.listLeft}>
            <View style={styles.listIconBox}>
              <Ionicons name="information-circle-outline" size={20} color="#475569" />
            </View>
            <View>
              <Text style={styles.listTitle}>App Version</Text>
              <Text style={styles.listSub}>Current build</Text>
            </View>
          </View>
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>

        {/* 4. ACTIVITY INFO */}
        <Text style={styles.sectionTitle}>Activity Log</Text>

        <View style={styles.listItem}>
          <View style={styles.listLeft}>
            <View style={[styles.listIconBox, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="log-in-outline" size={20} color="#16A34A" />
            </View>
            <View>
              <Text style={styles.listTitle}>Last Login</Text>
              <Text style={styles.listSub}>
                {user?.lastLogin
                  ? new Date(user.lastLogin).toLocaleDateString()
                  : "Never"}
              </Text>
            </View>
          </View>
          <Text style={styles.listMeta}>
            {user?.lastLogin
              ? new Date(user.lastLogin).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--"}
          </Text>
        </View>

        {/* 5. LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="power" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ================= MODALS ================= */}

      {/* EDIT PROFILE MODAL */}
      <Modal visible={editVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeader}>Edit Profile</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shop Name</Text>
              <TextInput
                style={styles.textInput}
                value={shopName}
                onChangeText={setShopName}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditVisible(false)}
                style={styles.btnCancel}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveProfile} style={styles.btnSave}>
                <Text style={styles.btnSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal visible={pwdModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeader}>Change Password</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.textInput}
                value={oldPwd}
                onChangeText={setOldPwd}
                secureTextEntry
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.textInput}
                value={newPwd}
                onChangeText={setNewPwd}
                secureTextEntry
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setPwdModal(false)}
                style={styles.btnCancel}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={changePassword} style={styles.btnSave}>
                <Text style={styles.btnSaveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
  },

  /* HEADER */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },

  /* HERO CARD (The Blue Box) */
  heroCard: {
    backgroundColor: "#2563EB", // Primary Blue from reference
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroWelcome: {
    color: "#BFDBFE",
    fontSize: 14,
    fontWeight: "500",
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 2,
  },
  heroShop: {
    color: "#E0E7FF",
    fontSize: 14,
    opacity: 0.9,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  editProfileText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginRight: 6,
    fontSize: 14,
  },

  /* GRID STATS (Orders/Items Style) */
  gridContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  gridLabel: {
    fontSize: 13,
    color: "#64748B",
  },

  /* SECTIONS & LISTS */
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
    marginLeft: 4,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  listLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  listIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  listSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  versionText: {
    color: "#64748B",
    fontWeight: "600",
  },
  listMeta: {
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 14,
  },

  /* LOGOUT */
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    backgroundColor: "#FEF2F2",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 20,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancelText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 15,
  },
  btnSave: {
    flex: 1,
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnSaveText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});