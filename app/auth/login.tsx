// app/auth/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { auth } from "../../firebase/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";

// Auto-login store
import { saveAuth } from "../../utils/authStore";

// Shared UI
import { authStyles } from "../../styles/authStyles";

export default function Login() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate Indian phone number
  const isValidIndianPhone = (value: string) => /^[6-9]\d{9}$/.test(value);

  const handleLogin = async () => {
    setError("");

    // VALIDATIONS
    if (!isValidIndianPhone(phone)) {
      setError(
        "Enter a valid 10-digit Indian phone number starting with 6/7/8/9."
      );
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const cleanedPhone = phone.replace(/\D/g, "");
      const generatedEmail = `${cleanedPhone}@sbs.app`;

      const userCredential = await signInWithEmailAndPassword(
        auth,
        generatedEmail,
        password
      );

      // Save login persistence
      await saveAuth(userCredential.user.uid);

      // Redirect to home
      router.replace("/home");
    } catch (err: any) {
      console.log("Login error:", err.code);

      if (err.code === "auth/user-not-found") {
        setError("This phone number is not registered. Please sign up first.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f7fb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#2A3CAD", "#1B2A7D"]}
          style={styles.headerGradient}
        >
          <View style={styles.waveOverlay} pointerEvents="none" />
        </LinearGradient>
      </View>

      {/* Form Card */}
      <View style={styles.contentWrap}>
        <View style={authStyles.card}>
          <Image
            source={require("../../assets/images/logo_small.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Welcome back!</Text>
          <Text style={styles.subtitle}>Login to continue</Text>

          {/* PHONE */}
          <Text style={authStyles.label}>Phone Number</Text>
          <View style={authStyles.inputBox}>
            <Text style={{ fontWeight: "600", marginRight: 8 }}>+91</Text>

            <TextInput
              value={phone}
              onChangeText={(txt) => {
                let cleaned = txt.replace(/\D/g, "");
                if (cleaned.length === 1 && !/[6-9]/.test(cleaned)) {
                  cleaned = "";
                }
                setPhone(cleaned.slice(0, 10));
              }}
              maxLength={10}
              keyboardType="number-pad"
              placeholder="9876543210"
              style={authStyles.input}
            />
          </View>

          {/* PASSWORD */}
          <Text style={[authStyles.label, { marginTop: 12 }]}>Password</Text>

          <View style={authStyles.inputBox}>
            <TextInput
              secureTextEntry={!showPassword}
              placeholder="Enter password"
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

          {/* ERROR */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* LOGIN BUTTON */}
          <TouchableOpacity onPress={handleLogin} disabled={loading}>
            <LinearGradient
              colors={["#3B82F6", "#9333EA"]}
              style={authStyles.button}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={authStyles.buttonText}>LOGIN</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* SIGNUP LINK */}
          <TouchableOpacity
            onPress={() => router.push("/auth/signup")}
            style={{ marginTop: 12, alignSelf: "center" }}
          >
            <Text style={styles.linkText}>Create new shop account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ONLY local styles here
const styles = StyleSheet.create({
  headerContainer: { height: 260, overflow: "hidden" },

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
    marginTop: -80,
  },

  logo: {
    width: 42,
    height: 42,
    position: "absolute",
    top: 14,
    left: 14,
  },

  title: {
    fontSize: 28,
    color: "#0f1724",
    fontWeight: "700",
    marginLeft: 68,
  },

  subtitle: {
    marginTop: 6,
    marginLeft: 68,
    color: "#6b7280",
  },

  linkText: {
    color: "#3B82F6",
    textDecorationLine: "underline",
    fontWeight: "600",
  },

  errorText: {
    color: "#db2777",
    marginTop: 6,
    fontSize: 13,
  },
});
