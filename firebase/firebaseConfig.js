// firebase/firebaseConfig.js

import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

// YOUR FIREBASE CREDENTIALS
const firebaseConfig = {
  apiKey: "AIzaSyCkEC8yB5eKhNnl9CNSa7lbZnzTGuIkINQ",
  authDomain: "smart-billing-system-c536e.firebaseapp.com",
  projectId: "smart-billing-system-c536e",
  storageBucket: "smart-billing-system-c536e.appspot.com",
  messagingSenderId: "1071682941086",
  appId: "1:1071682941086:web:ad90fc23579ace81f8cb8f"
};

// Initialize App
const app = initializeApp(firebaseConfig);

// FIX warning + ADD login persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore
export const db = getFirestore(app);

