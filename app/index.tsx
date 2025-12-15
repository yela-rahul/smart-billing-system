import { useEffect } from "react";
import { View, Image, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Index() {

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/auth/login");  // redirect to login
    }, 2000); // 2 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/splash_logo.png")}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
