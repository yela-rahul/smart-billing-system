// app/auth/_layout.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot, useRouter } from "expo-router";
import { isUserLoggedIn } from "../../utils/authStore";

export default function AuthLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const loggedIn = await isUserLoggedIn();

        if (loggedIn) {
          // Already logged in → send to home screen
          router.replace("/home");
        } else {
          // Not logged in → show login/signup normally
          setChecking(false);
        }
      } catch (error) {
        console.log("Auto-login check failed", error);
        setChecking(false);
      }
    };

    checkLogin();
  }, []);

  // While checking login status show loader
  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f6f7fb",
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Render children (login/signup)
  return <Slot />;
}
