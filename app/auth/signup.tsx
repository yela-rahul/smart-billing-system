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

// Shared styles (ensure this file exists at /styles/authStyles.js)
import { authStyles } from "../../styles/authStyles";

export default function Signup() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // For submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);

  // Validate Indian phone number (starts with 6/7/8/9 and 10 digits)
  const isValidIndianPhone = (value: string) => /^[6-9]\d{9}$/.test(value);

  // ---- REPLACED handleSignup: guarantees spinner stops and modal shows ----
  const handleSignup = async () => {
    // clear previous UI state
    setError("");
    setModalVisible(false);
    setModalTitle("");
    setModalMessage("");
    setModalSuccess(false);

    // Basic validations (don't set isSubmitting yet)
    if (!fullName.trim()) {
      setError("Please enter full name.");
      return;
    }
    if (!shopName.trim()) {
      setError("Please enter your shop name.");
      return;
    }
    if (!isValidIndianPhone(phone)) {
      setError("Enter a valid 10-digit phone number starting with 6/7/8/9.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("SIGNUP: starting signup for", phone);

      const cleanedPhone = phone.replace(/\D/g, "");
      const generatedEmail = `${cleanedPhone}@sbs.app`;
      console.log("SIGNUP: generatedEmail =", generatedEmail);

      // CREATE USER
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        generatedEmail,
        password
      );
      console.log("SIGNUP: firebase auth created", userCredential.user.uid);

      // SAVE PROFILE
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        fullName,
        shopName,
        phone: cleanedPhone,
        createdAt: new Date(),
      });
      console.log("SIGNUP: firestore doc written");

      // Show success modal (do NOT auto-redirect; user taps button)
      setModalTitle("Account Created!");
      setModalMessage("Your shop account has been created successfully.");
      setModalSuccess(true);
      setModalVisible(true);

    } catch (err: any) {
      console.log("SIGNUP CATCH:", err, err?.code, err?.message);

      // Show friendly error + modal
      if (err?.code === "auth/email-already-in-use") {
        setError("This phone number is already registered.");
        setModalTitle("Signup Failed");
        setModalMessage("This phone number is already registered.");
      } else if (err?.code === "auth/invalid-password") {
        setError("Password invalid or not allowed.");
        setModalTitle("Signup Failed");
        setModalMessage("Password invalid or not allowed.");
      } else {
        setError("Signup failed. Please try again.");
        setModalTitle("Signup Failed");
        setModalMessage("Signup failed. Please try again later.");
      }
      setModalSuccess(false);
      setModalVisible(true);
    } finally {
      // ALWAYS run this so spinner stops
      console.log("SIGNUP: finally - stopping spinner");
      setIsSubmitting(false);
    }
  };
  // ---- end handleSignup ----

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f7fb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={["#2A3CAD", "#1B2A7D"]}
            style={styles.headerGradient}
          >
            <View style={styles.waveOverlay} pointerEvents="none" />
          </LinearGradient>
        </View>

        {/* CONTENT */}
        <View style={styles.contentWrap}>
          <View style={authStyles.card}>
            <Image
              source={require("../../assets/images/logo_small.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Let’s get your shop started.</Text>
            <Text style={styles.subtitle}>Register to get started</Text>

            {/* FULL NAME */}
            <Text style={authStyles.label}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              style={authStyles.singleInput}
            />

            {/* SHOP NAME */}
            <Text style={authStyles.label}>Shop Name</Text>
            <TextInput
              value={shopName}
              onChangeText={setShopName}
              placeholder="Your shop / tiffin name"
              style={authStyles.singleInput}
            />

            {/* PHONE NUMBER */}
            <Text style={authStyles.label}>Phone Number</Text>
            <View style={authStyles.inputBox}>
              <Text style={{ fontWeight: "600", marginRight: 8 }}>+91</Text>
              <TextInput
                value={phone}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="9876543210"
                onChangeText={(txt) => {
                  let cleaned = txt.replace(/\D/g, "");
                  // if user types first digit ensure it's allowed start digit
                  if (cleaned.length === 1 && !/[6-9]/.test(cleaned)) {
                    cleaned = "";
                  }
                  setPhone(cleaned.slice(0, 10));
                }}
                style={authStyles.input}
              />
            </View>

            {/* PASSWORD */}
            <Text style={authStyles.label}>Password</Text>
            <View style={authStyles.inputBox}>
              <TextInput
                secureTextEntry={!showPassword}
                placeholder="Create password"
                value={password}
                onChangeText={setPassword}
                style={authStyles.input}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={authStyles.eyeIcon}>
                  {showPassword ? "🙈" : "👁️"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ERROR (inline) */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              onPress={handleSignup}
              activeOpacity={0.85}
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

            {/* LOGIN LINK */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginTop: 12, alignSelf: "center" }}
            >
              <Text style={styles.linkText}>Already have an account? Login</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FEEDBACK MODAL */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <View
              style={{
                width: "86%",
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
                {modalTitle}
              </Text>
              <Text style={{ color: "#444", marginBottom: 16 }}>{modalMessage}</Text>

              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                {!modalSuccess && (
                  <Pressable
                    onPress={() => setModalVisible(false)}
                    style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                  >
                    <Text style={{ color: "#333", fontWeight: "600" }}>Close</Text>
                  </Pressable>
                )}

                {modalSuccess && (
                  <Pressable
                    onPress={() => {
                      setModalVisible(false);
                      router.push("/auth/login");
                    }}
                    style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                  >
                    <Text style={{ color: "#2563EB", fontWeight: "700" }}>
                      Go to Login
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Screen-specific styles
const styles = StyleSheet.create({
  headerContainer: { height: 220, overflow: "hidden" },
  headerGradient: {
    flex: 1,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  waveOverlay: {
    position: "absolute",
    left: -40,
    right: -40,
    bottom: -20,
    height: 160,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 120,
    transform: [{ scaleX: 1.6 }],
  },
  contentWrap: {
    flex: 1,
    alignItems: "center",
    marginTop: -64,
    paddingBottom: 30,
  },
  logo: {
    width: 42,
    height: 42,
    position: "absolute",
    top: 14,
    left: 14,
  },
  title: {
    fontSize: 22,
    color: "#0f1724",
    fontWeight: "700",
    marginLeft: 68,
  },
  subtitle: {
    marginTop: 6,
    marginLeft: 68,
    color: "#6b7280",
  },
  errorText: {
    color: "#db2777",
    marginTop: 6,
    fontSize: 13,
  },
  linkText: {
    color: "#3B82F6",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});
