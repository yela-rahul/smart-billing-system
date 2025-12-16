// app/auth/signup.tsx
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

import { auth, db } from "../../firebase/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { authStyles } from "../../styles/authStyles";

export default function Signup() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  const isValidIndianPhone = (value: string) => /^[6-9]\d{9}$/.test(value);

  const handleSignup = async () => {
    setError("");
    setIsSubmitting(true);

    // --- 1. VALIDATIONS ---
    if (!fullName.trim()) {
      setError("Please enter full name.");
      setIsSubmitting(false);
      return;
    }

    if (!shopName.trim()) {
      setError("Please enter your shop name.");
      setIsSubmitting(false);
      return;
    }

    if (!isValidIndianPhone(phone)) {
      setError("Enter a valid phone number starting with 6/7/8/9.");
      setIsSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsSubmitting(false);
      return;
    }

    try {
      const cleanedPhone = phone.replace(/\D/g, "");
      const generatedEmail = `${cleanedPhone}@sbs.app`;

      console.log("👉 Step A: Creating Auth User...");
      
      // --- 2. CREATE AUTH USER ---
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        generatedEmail,
        password
      );

      const user = userCredential.user;
      console.log("✅ Step A Success: User created with UID:", user.uid);

      // --- 3. PREPARE FIRESTORE DATA ---
      // using .toISOString() is safer than new Date() object in React Native
      const userData = {
        uid: user.uid,
        fullName,
        shopName,
        phone: cleanedPhone,
        createdAt: new Date().toISOString(), 
      };

      console.log("👉 Step B: Saving to Firestore...");

      // --- 4. SAVE TO FIRESTORE ---
      await setDoc(doc(db, "users", user.uid), userData);
      
      console.log("✅ Step B Success: Data saved!");

      // --- 5. STOP LOADING & SHOW SUCCESS ---
      setIsSubmitting(false);
      
      setModalTitle("Account Created 🎉");
      setModalMessage("Your shop account has been created successfully.");
      setModalSuccess(true);
      setModalVisible(true);

    } catch (err: any) {
      console.error("❌ SIGNUP ERROR:", err);
      setIsSubmitting(false);

      if (err.code === "auth/email-already-in-use") {
        setModalTitle("Signup Failed");
        setModalMessage("This phone number is already registered.");
      } else {
        setModalTitle("Signup Failed");
        setModalMessage(err.message || "Something went wrong.");
      }

      setModalSuccess(false);
      setModalVisible(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f7fb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={["#2A3CAD", "#1B2A7D"]}
            style={styles.headerGradient}
          />
        </View>

        <View style={styles.contentWrap}>
          <View style={authStyles.card}>
            <Image
              source={require("../../assets/images/logo_small.png")}
              style={styles.logo}
            />

            <Text style={styles.title}>Let’s get your shop started.</Text>
            <Text style={styles.subtitle}>Register to get started</Text>

            <Text style={authStyles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              style={authStyles.singleInput}
            />

            <Text style={authStyles.label}>Shop Name</Text>
            <TextInput
              value={shopName}
              onChangeText={setShopName}
              style={authStyles.singleInput}
            />

            <Text style={authStyles.label}>Phone Number</Text>
            <View style={authStyles.inputBox}>
              <Text style={{ marginRight: 8 }}>+91</Text>
              <TextInput
                value={phone}
                maxLength={10}
                keyboardType="number-pad"
                onChangeText={(t) =>
                  setPhone(t.replace(/\D/g, "").slice(0, 10))
                }
                style={authStyles.input}
              />
            </View>

            <Text style={authStyles.label}>Password</Text>
            <View style={authStyles.inputBox}>
              <TextInput
                value={password}
                secureTextEntry={!showPassword}
                onChangeText={setPassword}
                style={authStyles.input}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity onPress={handleSignup} disabled={isSubmitting}>
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
          </View>
        </View>
      </ScrollView>

      {/* ✅ MODAL OUTSIDE SCROLLVIEW */}
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
            >
              <Text style={styles.modalBtn}>
                {modalSuccess ? "Go to Login" : "Close"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerContainer: { height: 220 },
  headerGradient: { flex: 1 },
  contentWrap: { marginTop: -60, alignItems: "center" },
  logo: { width: 42, height: 42, position: "absolute", top: 14, left: 14 },
  title: { fontSize: 22, fontWeight: "700", marginLeft: 68 },
  subtitle: { marginLeft: 68, color: "#6b7280" },
  errorText: { color: "#db2777", marginTop: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "85%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalMessage: { marginVertical: 12 },
  modalBtn: { color: "#2563EB", fontWeight: "700", textAlign: "right" },
});
