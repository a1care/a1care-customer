import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Colors } from "@/constants/colors";

const EASEBUZZ_URL = "https://testpay.easebuzz.in/pay/secure";

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

  const handleNav = (url: string) => {
    const low = url.toLowerCase();
    const isSuccess = low.includes("success") || low.includes("payment/success");
    const isFailed = low.includes("fail") || low.includes("failure") || low.includes("cancel");
    if (!isSuccess && !isFailed) return;

    router.replace({
      pathname: "/checkout/status",
      params: {
        status: isSuccess ? "success" : "failed",
        type: "WALLET_TOPUP",
      },
    } as any);
  };

  return (
    <SafeAreaView style={styles.root}>
      <WebView
        originWhitelist={["*"]}
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

