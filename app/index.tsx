import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { isUserLoggedIn, clearAuth } from "../utils/authStore";
import { auth } from "../firebase/firebaseConfig";

const { width, height } = Dimensions.get("window");

/* ── decorative receipt line ── */
function ReceiptLine({ delay, width: w, opacity }: { delay: number; width: number; opacity: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 600, delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        height: 3, width: w, borderRadius: 2,
        backgroundColor: "rgba(255,255,255," + opacity + ")",
        marginVertical: 4,
        opacity: anim,
        transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
      }}
    />
  );
}

export default function Index() {
  const router = useRouter();

  /* ── animation values ── */
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleY      = useRef(new Animated.Value(30)).current;
  const titleOp     = useRef(new Animated.Value(0)).current;
  const taglineOp   = useRef(new Animated.Value(0)).current;
  const dotsOp      = useRef(new Animated.Value(0)).current;
  const shimmer     = useRef(new Animated.Value(0)).current;
  const badgeOp     = useRef(new Animated.Value(0)).current;
  const badgeY      = useRef(new Animated.Value(20)).current;
  const dot1        = useRef(new Animated.Value(0.3)).current;
  const dot2        = useRef(new Animated.Value(0.3)).current;
  const dot3        = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    /* Logo pop-in */
    Animated.spring(logoScale, {
      toValue: 1, tension: 60, friction: 7, useNativeDriver: true,
    }).start();
    Animated.timing(logoOpacity, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();

    /* Title slide up */
    Animated.parallel([
      Animated.timing(titleY,  { toValue: 0, duration: 500, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(titleOp, { toValue: 1, duration: 500, delay: 350, useNativeDriver: true }),
    ]).start();

    /* Tagline fade */
    Animated.timing(taglineOp, { toValue: 1, duration: 500, delay: 600, useNativeDriver: true }).start();

    /* Badge */
    Animated.parallel([
      Animated.timing(badgeOp, { toValue: 1, duration: 400, delay: 800, useNativeDriver: true }),
      Animated.timing(badgeY,  { toValue: 0, duration: 400, delay: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    /* Loading dots */
    Animated.timing(dotsOp, { toValue: 1, duration: 300, delay: 900, useNativeDriver: true }).start();

    /* Shimmer loop on logo border */
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    /* Dot pulse loop */
    const pulseDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();

    setTimeout(() => {
      pulseDot(dot1, 0);
      pulseDot(dot2, 200);
      pulseDot(dot3, 400);
    }, 900);

    /* Auth check after animations settle */
    const timer = setTimeout(async () => {
      try {
        const localLoggedIn = await isUserLoggedIn();
        const firebaseUser  = auth.currentUser;
        if (localLoggedIn && firebaseUser) {
          router.replace("/tabs/home");
        } else {
          await clearAuth();
          router.replace("/auth/login");
        }
      } catch {
        router.replace("/auth/login");
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });

  return (
    <LinearGradient colors={["#0A1A45", "#0F2557", "#1A3A7A"]} style={s.container}>

      {/* ── Subtle background grid ── */}
      <View style={s.bgGrid} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[s.bgLine, { top: (i * height) / 6 }]} />
        ))}
      </View>

      {/* ── Decorative receipt strips (top-right) ── */}
      <View style={s.receiptStrip} pointerEvents="none">
        <ReceiptLine delay={700}  width={80}  opacity={0.12} />
        <ReceiptLine delay={800}  width={55}  opacity={0.08} />
        <ReceiptLine delay={900}  width={70}  opacity={0.10} />
        <ReceiptLine delay={1000} width={40}  opacity={0.07} />
        <ReceiptLine delay={1100} width={65}  opacity={0.09} />
      </View>

      {/* ── Decorative receipt strips (bottom-left) ── */}
      <View style={[s.receiptStrip, { top: undefined, bottom: 140, left: 24, alignItems: "flex-start" }]} pointerEvents="none">
        <ReceiptLine delay={900}  width={60}  opacity={0.10} />
        <ReceiptLine delay={1000} width={45}  opacity={0.07} />
        <ReceiptLine delay={1100} width={75}  opacity={0.09} />
      </View>

      {/* ── Main content ── */}
      <View style={s.center}>

        {/* Logo ring with shimmer */}
        <Animated.View style={[s.logoRing, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          {/* Shimmer sweep */}
          <Animated.View
            style={[s.shimmer, { transform: [{ translateX: shimmerX }] }]}
            pointerEvents="none"
          />
          <Image
            source={require("../assets/images/logo.png")}
            style={s.logo}
            resizeMode="cover"
          />
        </Animated.View>

        {/* App name */}
        <Animated.Text style={[s.appName, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          Smart Billing
        </Animated.Text>
        <Animated.Text style={[s.appNameAccent, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
          System
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[s.tagline, { opacity: taglineOp }]}>
          Fast · Accurate · Professional
        </Animated.Text>

        {/* Feature badges */}
        <Animated.View style={[s.badgeRow, { opacity: badgeOp, transform: [{ translateY: badgeY }] }]}>
          {[
            { icon: "🧾", text: "Smart Bills" },
            { icon: "📊", text: "Dashboard" },
            { icon: "🏪", text: "Shop Ready" },
          ].map(({ icon, text }) => (
            <View key={text} style={s.badge}>
              <Text style={s.badgeIcon}>{icon}</Text>
              <Text style={s.badgeText}>{text}</Text>
            </View>
          ))}
        </Animated.View>

      </View>

      {/* ── Loading indicator ── */}
      <Animated.View style={[s.dotsWrap, { opacity: dotsOp }]}>
        <Text style={s.loadingLabel}>Loading your workspace</Text>
        <View style={s.dots}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View key={i} style={[s.dot, { opacity: dot }]} />
          ))}
        </View>
      </Animated.View>

      {/* ── Version footer ── */}
      <Text style={s.version}>v1.0.0</Text>

    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* Background grid */
  bgGrid: { ...StyleSheet.absoluteFillObject },
  bgLine: {
    position: "absolute", left: 0, right: 0,
    height: 1, backgroundColor: "rgba(255,255,255,0.03)",
  },

  /* Receipt decorations */
  receiptStrip: {
    position: "absolute", top: 80, right: 24,
    alignItems: "flex-end",
  },

  /* Center content */
  center: { alignItems: "center", paddingHorizontal: 32 },

  /* Logo */
  logoRing: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 3, borderColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
    shadowColor: "#4A90D9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
    marginBottom: 28,
  },
  logo: { width: "100%", height: "100%" },
  shimmer: {
    position: "absolute", top: 0, bottom: 0, width: 60,
    backgroundColor: "rgba(255,255,255,0.12)",
    transform: [{ skewX: "-20deg" }],
    zIndex: 2,
  },

  /* App name */
  appName: {
    fontSize: 36, fontWeight: "900", color: "#FFFFFF",
    letterSpacing: 1.5, textAlign: "center",
    textShadowColor: "rgba(74,144,217,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  appNameAccent: {
    fontSize: 26, fontWeight: "700", color: "#4A90D9",
    letterSpacing: 6, textAlign: "center", marginTop: -4,
    textShadowColor: "rgba(74,144,217,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  /* Tagline */
  tagline: {
    fontSize: 13, color: "rgba(255,255,255,0.5)",
    letterSpacing: 1, marginTop: 10, textAlign: "center",
  },

  /* Feature badges */
  badgeRow: {
    flexDirection: "row", gap: 10, marginTop: 28,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  badgeIcon: { fontSize: 20, marginBottom: 4 },
  badgeText: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" },

  /* Loading dots */
  dotsWrap: { position: "absolute", bottom: 60, alignItems: "center", gap: 10 },
  loadingLabel: { fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5 },
  dots: { flexDirection: "row", gap: 8, marginTop: 8 },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: "#4A90D9",
  },

  /* Version */
  version: {
    position: "absolute", bottom: 24,
    fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: 1,
  },
});