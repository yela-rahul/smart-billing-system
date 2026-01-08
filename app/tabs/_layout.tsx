import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563EB",
        tabBarStyle: {
          height: 68,
          paddingBottom: 8,
        },
      }}
    >
      {/* 1. HOME */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 2. MENU */}
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 3. ➕ NEW BILL (CENTER FAB) */}
      <Tabs.Screen
        name="new-bill"
        options={{
          title: "",
          tabBarShowLabel: false,
          tabBarIcon: () => (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#2563EB",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 30,
                elevation: 6,
                // Shadow for iOS
                shadowColor: "#2563EB",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
              }}
            >
              <Ionicons name="add" size={32} color="#fff" />
            </View>
          ),
        }}
      />

      {/* 4. BILLS */}
      <Tabs.Screen
        name="bills"
        options={{
          title: "Bills",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 5. DASHBOARD */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 🔒 HIDE INTERNAL ROUTES */}
      
      {/* Existing Hidden Route */}
      <Tabs.Screen name="menu/[categoryId]" options={{ href: null }} />

      {/* ✅ NEW ADDITION: Hide Bill Preview from Tab Bar */}
      <Tabs.Screen 
        name="bill-preview" 
        options={{ 
          href: null, // Removes icon from bottom bar
          tabBarStyle: { display: "none" } // Optional: Hides tab bar when on this screen
        }} 
      />

    </Tabs>
  )};
