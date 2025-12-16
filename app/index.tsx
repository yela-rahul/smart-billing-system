import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { auth } from "../firebase/firebaseConfig";
import { isUserLoggedIn, clearAuth } from "../utils/authStore";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const localLoggedIn = await isUserLoggedIn();
      const firebaseUser = auth.currentUser;

      // ✅ BOTH must be true
      if (localLoggedIn && firebaseUser) {
        router.replace("/home");
      } else {
        // ❌ Any mismatch → force logout
        await clearAuth();
        router.replace("/auth/login");
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

