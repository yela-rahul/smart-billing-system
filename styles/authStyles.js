import { StyleSheet } from "react-native";

export const authStyles = StyleSheet.create({
  // White card used in Login & Signup
  card: {
    width: "86%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },

  // Label above inputs
  label: {
    color: "#374151",
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
    fontWeight: "500",
  },

  // Phone, Password input container
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },

  // Text input inside inputBox
  input: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 0,
  },

  // Single full-width TextInput (full name, shop name)
  singleInput: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 16,
    color: "#111827",
    marginBottom: 6,
  },

  // Gradient button
  button: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  // Button text
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  // Eye icon for password
  eyeIcon: {
    fontSize: 20,
    paddingHorizontal: 6,
  },
});
