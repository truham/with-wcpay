import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTurnkey, ClientState } from "@turnkey/react-native-wallet-kit";
import {
  isMockPaymentLink,
  getMockPaymentOptions,
  MERCHANT_ADDRESS,
  USDC_BASE,
} from "@/lib/mock-wc-pay";
import { Colors } from "@/constants/theme";

const colors = Colors.dark;

const BASE_RPC = "https://mainnet.base.org";

async function fetchUsdcBalance(walletAddress: string): Promise<string> {
  const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const data = "0x70a08231" + paddedAddress;
  try {
    const resp = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: USDC_BASE, data }, "latest"],
      }),
    });
    const json = await resp.json();
    if (json.result) {
      const raw = BigInt(json.result);
      const whole = raw / BigInt(1e6);
      const frac = raw % BigInt(1e6);
      return `${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
    }
  } catch (e) {
    console.error("USDC balance fetch error:", e);
  }
  return "—";
}

type PaymentStep =
  | "loading"
  | "options"
  | "signing"
  | "success"
  | "failed"
  | "error";

export default function PaymentScreen() {
  const { paymentLink, usdcBalance: passedBalance, amount: amountParam } = useLocalSearchParams<{
    paymentLink: string;
    usdcBalance?: string;
    amount?: string;
  }>();
  const amountUsdc = parseFloat(amountParam || "5") || 5;
  const router = useRouter();

  const { wallets, ethSendErc20Transfer, ethSendTransaction, pollTransactionStatus, httpClient, session, clientState } = useTurnkey();

  const ethAccount = wallets
    ?.flatMap((w) => w.accounts || [])
    .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");
  const walletAddress = ethAccount?.address || "";

  const [step, setStep] = useState<PaymentStep>("loading");
  const [paymentOptions, setPaymentOptions] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [txResult, setTxResult] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>(passedBalance || "...");

  useEffect(() => {
    if (paymentLink && walletAddress && clientState === ClientState.Ready) {
      fetchPaymentOptions();
    }
  }, [paymentLink, walletAddress, clientState]);

  useEffect(() => {
    if (walletAddress && !passedBalance) {
      fetchUsdcBalance(walletAddress).then(setUsdcBalance);
    }
  }, [walletAddress, passedBalance]);

  const fetchPaymentOptions = async () => {
    try {
      setStep("loading");
      if (isMockPaymentLink(paymentLink!)) {
        const options = getMockPaymentOptions(walletAddress, amountUsdc);
        setPaymentOptions(options);
        setSelectedOption(options.options[0]);
        setStep("options");
      } else {
        setStep("error");
        setErrorMessage("Only demo payment links are supported in this build.");
      }
    } catch (error: any) {
      setStep("error");
      setErrorMessage(error.message || "Failed to load payment.");
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedOption || !paymentOptions || !ethAccount) return;

    try {
      setStep("signing");

      console.log("[WCPay] Sending USDC transfer via Turnkey...");
      const tokenUnits = Math.round(amountUsdc * 1e6);
      console.log("[WCPay] From:", walletAddress);
      console.log("[WCPay] To:", MERCHANT_ADDRESS);
      console.log(`[WCPay] Amount: ${amountUsdc} USDC (${tokenUnits} units) on Base`);

      // Use ethSendErc20Transfer — Turnkey handles construction, signing,
      // and broadcast. With sponsor: true, gas is covered by Turnkey.
      let result: any;

      if (ethSendErc20Transfer) {
        console.log("[WCPay] Using ethSendErc20Transfer...");
        result = await ethSendErc20Transfer({
          transfer: {
            from: walletAddress,
            to: MERCHANT_ADDRESS,
            tokenAddress: USDC_BASE,
            amount: String(tokenUnits), // USDC has 6 decimals
            caip2: "eip155:8453", // Base mainnet
            sponsor: true, // Gasless!
          },
        });
      } else if (ethSendTransaction) {
        // Fallback to ethSendTransaction with raw calldata
        console.log("[WCPay] Falling back to ethSendTransaction...");
        const transferSelector = "a9059cbb";
        const toAddrPadded = MERCHANT_ADDRESS.slice(2).toLowerCase().padStart(64, "0");
        const amountPadded = tokenUnits.toString(16).padStart(64, "0");
        const data = "0x" + transferSelector + toAddrPadded + amountPadded;

        result = await ethSendTransaction({
          transaction: {
            from: walletAddress,
            to: USDC_BASE,
            value: "0",
            data,
            caip2: "eip155:8453",
            sponsor: true,
          },
        });
      } else {
        throw new Error("No EVM send method available from Turnkey wallet kit.");
      }

      const sendTransactionStatusId = typeof result === "string" ? result : result?.sendTransactionStatusId;
      console.log("[WCPay] sendTransactionStatusId:", sendTransactionStatusId, "type:", typeof sendTransactionStatusId, "raw result:", JSON.stringify(result));

      // Poll Turnkey for the on-chain tx hash
      let txHash: string | undefined;

      if (sendTransactionStatusId) {
        // Try 1: Use the wallet kit's pollTransactionStatus
        if (pollTransactionStatus) {
          try {
            console.log("[WCPay] Polling via pollTransactionStatus...");
            const status = await pollTransactionStatus({ sendTransactionStatusId });
            console.log("[WCPay] Poll result:", JSON.stringify(status));
            txHash = status.eth?.txHash;
            if (!txHash && status.txError) {
              console.error("[WCPay] Poll returned txError:", status.txError);
            }
          } catch (pollError: any) {
            console.error("[WCPay] pollTransactionStatus failed:", pollError?.message);
            console.error("[WCPay] pollTransactionStatus full error:", JSON.stringify(pollError, Object.getOwnPropertyNames(pollError), 2));
          }
        }

        // Try 2: Manual poll via httpClient.getSendTransactionStatus
        if (!txHash && httpClient) {
          try {
            const orgId = session?.organizationId;
            if (orgId) {
              console.log("[WCPay] Falling back to manual poll via httpClient...");
              const maxAttempts = 20;
              for (let i = 0; i < maxAttempts; i++) {
                await new Promise((r) => setTimeout(r, 1500));
                const resp = await httpClient.getSendTransactionStatus({
                  organizationId: orgId,
                  sendTransactionStatusId,
                });
                console.log(`[WCPay] Manual poll attempt ${i + 1}:`, JSON.stringify(resp));
                if (resp.eth?.txHash) {
                  txHash = resp.eth.txHash;
                  break;
                }
                if (resp.txStatus === "FAILED" || resp.txStatus === "CANCELLED") {
                  console.error("[WCPay] Transaction failed on-chain:", resp.txError || resp.txStatus);
                  break;
                }
                if (resp.txStatus === "COMPLETED" || resp.txStatus === "INCLUDED") {
                  txHash = resp.eth?.txHash;
                  break;
                }
              }
            } else {
              console.error("[WCPay] No organizationId available for manual poll");
            }
          } catch (manualError: any) {
            console.error("[WCPay] Manual poll failed:", manualError?.message);
            console.error("[WCPay] Manual poll full error:", JSON.stringify(manualError, Object.getOwnPropertyNames(manualError), 2));
          }
        }
      }

      if (txHash) {
        console.log("[WCPay] Got on-chain tx hash:", txHash);
        setTxResult(txHash);
      } else {
        console.log("[WCPay] No tx hash obtained, showing statusId as fallback");
        setTxResult(sendTransactionStatusId || JSON.stringify(result));
      }

      setStep("success");
    } catch (error: any) {
      console.error("Payment failed:", error);
      setStep("failed");
      setErrorMessage(
        error.message ||
          "Transaction failed. Ensure the wallet has USDC on Base and sponsored transactions are enabled."
      );
    }
  };

  const handleDone = () => router.dismissAll();
  const handleRetry = () => {
    setStep("loading");
    setErrorMessage("");
    fetchPaymentOptions();
  };

  // ─── Renders ─────────────────────────────────────────────────

  if (step === "loading")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.secondaryText }]}>
            Loading payment...
          </Text>
        </View>
      </View>
    );

  if (step === "signing")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusTitle, { color: colors.primaryText }]}>
            Sending payment...
          </Text>
          <Text style={[styles.statusSub, { color: colors.secondaryText }]}>
            Turnkey is constructing, signing, sponsoring, and broadcasting your USDC transfer.
          </Text>
        </View>
      </View>
    );

  if (step === "success")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={styles.resultEmoji}>✅</Text>
          <Text style={[styles.resultTitle, { color: colors.primaryText }]}>
            Payment Successful!
          </Text>
          <Text style={[styles.resultSub, { color: colors.secondaryText }]}>
            {paymentOptions?.info?.merchant?.name} has been paid ${amountUsdc.toFixed(2)} USDC
          </Text>

          {txResult && (
            <View
              style={[styles.txCard, { backgroundColor: "#1E1F20" }]}
            >
              <Text style={[styles.txLabel, { color: colors.secondaryText }]}>
                Transaction
              </Text>
              <Text style={[styles.txValue, { color: colors.primaryText }]}>
                {txResult.length > 42
                  ? txResult.slice(0, 22) + "..." + txResult.slice(-20)
                  : txResult}
              </Text>
            </View>
          )}

          <View style={styles.demoBadge}>
            <Text style={styles.demoBadgeText}>
              Transaction management provided by Turnkey.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={handleDone}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  if (step === "failed" || step === "error")
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={styles.resultEmoji}>{step === "failed" ? "❌" : "⚠️"}</Text>
          <Text style={[styles.resultTitle, { color: colors.primaryText }]}>
            {step === "failed" ? "Payment Failed" : "Error"}
          </Text>
          <Text style={[styles.resultSub, { color: colors.secondaryText }]}>
            {errorMessage}
          </Text>
          {step === "failed" && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelButton} onPress={handleDone}>
            <Text style={[styles.cancelText, { color: colors.secondaryText }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  // step === "options"
  const info = paymentOptions?.info;
  const amount = selectedOption?.amount?.display;
  const payAmount = info?.amount;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.optionsContainer}>
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>
            This transaction is free! Gas sponsorship provided by Turnkey.
          </Text>
        </View>

        <View style={styles.merchantCard}>
          <Text style={[styles.merchantLabel, { color: colors.secondaryText }]}>Paying</Text>
          <Text style={[styles.merchantName, { color: colors.primaryText }]}>
            {info?.merchant?.name || "Merchant"}
          </Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.amountCurrency, { color: colors.secondaryText }]}>$</Text>
          <Text style={[styles.amountValue, { color: colors.primaryText }]}>
            {formatAmount(payAmount?.value, payAmount?.display?.decimals)}
          </Text>
        </View>
        <Text style={[styles.amountSubtext, { color: colors.secondaryText }]}>
          {amount?.assetSymbol || "USDC"} on {amount?.networkName || "Base"}
        </Text>

        <View style={[styles.detailCard, { backgroundColor: "#1E1F20" }]}>
          <Row label="Network" value="Base" />
          <Row label="Asset" value="USDC" />
          <Row label="Gas" value="Sponsored (free)" />
          <Row label="Available Balance" value={`${usdcBalance} USDC`} />
          <Row label="From" value={`${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`} mono />
          <Row label="To" value={`${MERCHANT_ADDRESS.slice(0, 6)}...${MERCHANT_ADDRESS.slice(-4)}`} mono />
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.primary }]}
          onPress={handleConfirmPayment}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>Confirm & Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: colors.secondaryText }]}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.secondaryText }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.primaryText }, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function formatAmount(value?: string, decimals?: number): string {
  if (!value) return "0.00";
  return (parseInt(value, 10) / Math.pow(10, decimals || 2)).toFixed(2);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  statusTitle: { fontSize: 20, fontWeight: "700", marginTop: 20 },
  statusSub: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 },
  optionsContainer: { padding: 24, paddingBottom: 40 },
  demoBadge: {
    backgroundColor: "#1a2744", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, alignSelf: "center", marginBottom: 16, marginTop: 8,
  },
  demoBadgeText: { fontSize: 13, color: "#93b4fd", fontWeight: "600", textAlign: "center" },
  merchantCard: { alignItems: "center", marginBottom: 8 },
  merchantLabel: { fontSize: 14, marginBottom: 4 },
  merchantName: { fontSize: 24, fontWeight: "bold" },
  amountContainer: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginTop: 20 },
  amountCurrency: { fontSize: 28, fontWeight: "600", marginTop: 8 },
  amountValue: { fontSize: 56, fontWeight: "800" },
  amountSubtext: { fontSize: 16, textAlign: "center", marginBottom: 24, fontWeight: "500" },
  detailCard: { borderRadius: 14, padding: 16, marginBottom: 16, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: "600" },
  mono: { fontFamily: "monospace" },
  confirmButton: { paddingVertical: 18, borderRadius: 14, alignItems: "center", marginBottom: 12 },
  confirmButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cancelButton: { paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 16 },
  resultEmoji: { fontSize: 64, marginBottom: 16 },
  resultTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  resultSub: { fontSize: 15, textAlign: "center", marginBottom: 8 },
  txCard: { borderRadius: 14, padding: 16, marginTop: 20, width: "100%", gap: 6 },
  txLabel: { fontSize: 12, fontWeight: "600" },
  txValue: { fontSize: 13, fontFamily: "monospace", fontWeight: "500" },
  txNote: { fontSize: 11, marginTop: 4 },
  doneButton: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14, marginTop: 24 },
  doneButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  retryButton: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14, marginTop: 16, marginBottom: 8 },
  retryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
