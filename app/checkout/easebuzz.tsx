import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Colors } from "@/constants/colors";

const EASEBUZZ_URL = process.env.EXPO_PUBLIC_EASEBUZZ_URL || "https://testpay.easebuzz.in/pay/secure";

function buildAutoSubmitHtml(fields: Record<string, string>) {
  const inputs = Object.entries(fields)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${String(value ?? "").replace(/"/g, "&quot;")}"/>`)
    .join("");

  return `
    <!doctype html>
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body>
        <form id="easebuzzForm" method="post" action="${EASEBUZZ_URL}">
          ${inputs}
        </form>
        <script>document.getElementById('easebuzzForm').submit();</script>
      </body>
    </html>
  `;
}

export default function EasebuzzCheckout() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();

  const html = React.useMemo(() => {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, value]) => typeof value === "string" && value.length > 0)
    );
    return buildAutoSubmitHtml(filtered);
  }, [params]);

  const EASEBUZZ_DOMAINS = ['testpay.easebuzz.in', 'pay.easebuzz.in', 'dashboard.easebuzz.in'];

  const handleNav = (url: string) => {
    try {
      const parsed = new URL(url);
      // Only react to redirects from Easebuzz domains
      if (!EASEBUZZ_DOMAINS.some(d => parsed.hostname.endsWith(d))) return;
      const path = parsed.pathname.toLowerCase();
      const isSuccess = path.endsWith('/success') || path.includes('/payment/success');
      const isFailed = path.endsWith('/failure') || path.endsWith('/fail') || path.endsWith('/cancel');
      if (!isSuccess && !isFailed) return;
      router.replace({
        pathname: "/checkout/status",
        params: { status: isSuccess ? "success" : "failed", type: "WALLET_TOPUP" },
      } as any);
    } catch {
      // invalid URL — ignore
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <WebView
        originWhitelist={["https://testpay.easebuzz.in", "https://pay.easebuzz.in", "https://dashboard.easebuzz.in", "about:*"]}
        source={{ html }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
        onNavigationStateChange={(state) => handleNav(state.url)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
});

