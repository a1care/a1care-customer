import React from "react";
import { ActivityIndicator, StyleSheet, View, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Colors } from "@/constants/colors";

function buildAutoSubmitHtml(accessKey: string, actionUrl: string) {
  return `
    <!doctype html>
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body>
        <form id="easebuzzForm" method="post" action="${actionUrl}">
          <input type="hidden" name="access_key" value="${String(accessKey).replace(/"/g, "&quot;")}"/>
        </form>
        <script>document.getElementById('easebuzzForm').submit();</script>
      </body>
    </html>
  `;
}

export default function EasebuzzCheckout() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();

  const actionUrl = React.useMemo(() => {
    const isProd = params.env === "prod" || params.env === "production";
    return isProd 
      ? "https://pay.easebuzz.in/pay/secure" 
      : "https://testpay.easebuzz.in/pay/secure";
  }, [params.env]);

  const html = React.useMemo(() => {
    const accessKey = params.accessKey || params.access_key || "";
    return buildAutoSubmitHtml(accessKey, actionUrl);
  }, [params.accessKey, params.access_key, actionUrl]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAYMENT_COMPLETE') {
        const isSuccess = event.data.status === 'success';
        console.log("[Easebuzz Web] Payment complete status received:", event.data.status);
        router.replace({
          pathname: "/checkout/status",
          params: { 
            status: isSuccess ? "SUCCESS" : "FAILED", 
            type: params.type || "BOOKING",
            amount: params.amount || "",
            txnId: event.data.txnId || "",
            bookingId: params.bookingId || "",
            bookingType: params.bookingType || "",
            description: params.type === 'WALLET_TOPUP' ? 'Wallet Top-up via Easebuzz' : 'Booking Payment via Easebuzz'
          },
        } as any);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [params.type, params.amount, params.bookingId, params.bookingType]);

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
        params: { 
          status: isSuccess ? "SUCCESS" : "FAILED", 
          type: params.type || "BOOKING",
          amount: params.amount || "",
          bookingId: params.bookingId || "",
          bookingType: params.bookingType || "",
          description: params.type === 'WALLET_TOPUP' ? 'Wallet Top-up via Easebuzz' : 'Booking Payment via Easebuzz'
        },
      } as any);
    } catch {
      // invalid URL — ignore
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Easebuzz Checkout"
        />
      ) : (
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
});

