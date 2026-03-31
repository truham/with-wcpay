import { WalletConnectPay } from "@walletconnect/pay";

const WC_APP_ID = process.env.EXPO_PUBLIC_WC_APP_ID || "";

// Singleton WalletConnect Pay client
let wcPayClient: WalletConnectPay | null = null;

export function getWcPayClient(): WalletConnectPay {
  if (!wcPayClient) {
    wcPayClient = new WalletConnectPay({
      appId: WC_APP_ID,
    });
  }
  return wcPayClient;
}

// Base mainnet chain ID in CAIP-2 format
export const BASE_CHAIN_ID = "eip155:8453";

// Build CAIP-10 accounts array for a given wallet address
export function buildAccounts(walletAddress: string): string[] {
  return [
    `eip155:1:${walletAddress}`, // Ethereum mainnet
    `eip155:8453:${walletAddress}`, // Base
    `eip155:10:${walletAddress}`, // Optimism
    `eip155:137:${walletAddress}`, // Polygon
    `eip155:42161:${walletAddress}`, // Arbitrum
  ];
}
