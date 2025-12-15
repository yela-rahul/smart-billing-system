import * as SecureStore from "expo-secure-store";

export async function saveAuth(uid) {
  await SecureStore.setItemAsync("loggedIn", "true");
  await SecureStore.setItemAsync("uid", uid);
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync("loggedIn");
  await SecureStore.deleteItemAsync("uid");
}

export async function isUserLoggedIn() {
  const value = await SecureStore.getItemAsync("loggedIn");
  return value === "true";
}

export async function getUserId() {
  return await SecureStore.getItemAsync("uid");
}

