import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; // Ensure you have expo-vector-icons installed

import { auth, db } from "../../firebase/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { authStyles } from "../../styles/authStyles";

export default function Signup() {
  const router = useRouter();

  // Form States
  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  const isValidIndianPhone = (value: string) => /^[6-9]\d{9}$/.test(value);

  const handleSignup = async () => {
    setError("");
    
    // --- 1. EXTENDED VALIDATIONS ---
    if (!fullName.trim() || !shopName.trim()) {
      setError("Please fill in all profile details.");
      return;
    }

    if (!isValidIndianPhone(phone)) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanedPhone = phone.replace(/\D/g, "");
      const generatedEmail = `${cleanedPhone}@sbs.app`;

      // --- 2. CREATE AUTH USER ---
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        generatedEmail,
        password
      );

      const user = userCredential.user;

      // --- 3. SAVE TO FIRESTORE ---
      const userData = {
        uid: user.uid,
        fullName: fullName.trim(),
        shopName: shopName.trim(),
        phone: cleanedPhone,
        role: "shop_owner", // Best practice: define roles early
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "users", user.uid), userData);
      
      setIsSubmitting(false);
      setModalTitle("Success! 🎊");
      setModalMessage("Your shop account is ready. Please login to continue.");
      setModalSuccess(true);
      setModalVisible(true);

    } catch (err: any) {
      setIsSubmitting(false);
      if (err.code === "auth/email-already-in-use") {
        setError("This phone number is already registered.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        
        {/* HEADER SECTION */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={["#2A3CAD", "#1B2A7D"]}
            style={styles.headerGradient}
          >
            <TouchableOpacity 
              style={styles.backIconButton} 
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <View style={styles.contentWrap}>
          <View style={[authStyles.card, styles.customCard]}>
            <View style={styles.titleSection}>
                <Image
                source={require("../../assets/images/logo_small.png")}
                style={styles.logo}
                />
                <View>
                    <Text style={styles.title}>Create Shop</Text>
                    <Text style={styles.subtitle}>Fill details to get started</Text>
                </View>
            </View>

            {/* FULL NAME */}
            <Text style={authStyles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              placeholder="John Doe"
              onChangeText={setFullName}
              style={authStyles.singleInput}
            />

            {/* SHOP NAME */}
            <Text style={authStyles.label}>Shop Name</Text>
            <TextInput
              value={shopName}
              placeholder="Modern General Store"
              onChangeText={setShopName}
              style={authStyles.singleInput}
            />

            {/* PHONE */}
            <Text style={authStyles.label}>Phone Number</Text>
            <View style={authStyles.inputBox}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                value={phone}
                maxLength={10}
                placeholder="00000 00000"
                keyboardType="number-pad"
                onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
                style={authStyles.input}
              />
            </View>

            {/* PASSWORD */}
            <Text style={authStyles.label}>Password</Text>
            <View style={authStyles.inputBox}>
              <TextInput
                value={password}
                secureTextEntry={!showPassword}
                placeholder="Min. 6 characters"
                onChangeText={setPassword}
                style={authStyles.input}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* RE-ENTER PASSWORD (NO PASTE) */}
            <Text style={authStyles.label}>Confirm Password</Text>
            <View style={authStyles.inputBox}>
              <TextInput
                value={confirmPassword}
                secureTextEntry={!showPassword}
                placeholder="Repeat password"
                onChangeText={setConfirmPassword}
                style={authStyles.input}
                contextMenuHidden={true} // Disables copy/paste menu
                selectTextOnFocus={false}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity 
                style={styles.mainBtnContainer} 
                onPress={handleSignup} 
                disabled={isSubmitting}
            >
              <LinearGradient
                colors={["#3B82F6", "#9333EA"]}
                style={authStyles.button}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={authStyles.buttonText}>CREATE ACCOUNT</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* BACK TO LOGIN OPTION */}
            <TouchableOpacity 
                onPress={() => router.push("/auth/login")}
                style={styles.loginLink}
            >
                <Text style={styles.loginLinkText}>
                    Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
                </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <Pressable
              onPress={() => {
                setModalVisible(false);
                if (modalSuccess) router.replace("/auth/login");
              }}
              style={styles.modalAction}
            >
              <Text style={styles.modalBtnText}>
                {modalSuccess ? "Go to Login" : "Try Again"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },
  headerContainer: { height: 180 },
  headerGradient: { flex: 1, paddingTop: 50, paddingHorizontal: 20 },
  backIconButton: { width: 40, height: 40, justifyContent: 'center' },
  contentWrap: { marginTop: -80, alignItems: "center", paddingBottom: 30 },
  customCard: { width: '90%', paddingVertical: 25 },
  titleSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, width: '100%' },
  logo: { width: 45, height: 45, marginRight: 15 },
  title: { fontSize: 22, fontWeight: "800", color: '#1f2937' },
  subtitle: { color: "#6b7280", fontSize: 14 },
  countryCode: { marginRight: 8, fontWeight: '600', color: '#374151' },
  errorText: { color: "#db2777", marginTop: 10, fontSize: 13, textAlign: 'center', fontWeight: '500' },
  mainBtnContainer: { marginTop: 20, width: '100%' },
  loginLink: { marginTop: 20, alignSelf: 'center' },
  loginLinkText: { color: '#6b7280', fontSize: 14 },
  loginLinkBold: { color: '#3B82F6', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    width: "80%",
    elevation: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: '#111827' },
  modalMessage: { marginVertical: 12, color: '#4b5563', lineHeight: 20 },
  modalAction: { marginTop: 10, alignSelf: 'flex-end' },
  modalBtnText: { color: "#2563EB", fontWeight: "700", fontSize: 16 },
});