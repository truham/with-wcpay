/**
 * Mock WalletConnect Pay Service
 *
 * Simulates the WC Pay merchant backend for demo purposes.
 * Uses Turnkey's signAndSendTransaction for gasless sponsored transactions.
 *
 * Test payment link format: "demo" or anything containing "test_demo"
 */

const MERCHANT_ADDRESS = "0x5Ed69A4b20c7Ebf9AE6d7A881BeC4c7f647078f9";

// USDC contract on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export interface MockPaymentOptions {
  paymentId: string;
  info: {
    status: string;
    amount: {
      unit: string;
      value: string;
      display: {
        assetSymbol: string;
        assetName: string;
        decimals: number;
        networkName: string;
      };
    };
    expiresAt: number;
    merchant: {
      name: string;
    };
  };
  options: MockPaymentOption[];
}

export interface MockPaymentOption {
  id: string;
  amount: {
    unit: string;
    value: string;
    display: {
      assetSymbol: string;
      assetName: string;
      decimals: number;
      networkName: string;
    };
  };
  etaS: number;
}

export function isMockPaymentLink(link: string): boolean {
  return link.includes("test_demo") || link.includes("mock") || link === "demo";
}

export function getMockPaymentOptions(walletAddress: string, amountUsdc: number = 5): MockPaymentOptions {
  const tokenUnits = Math.round(amountUsdc * 1e6);
  const displayCents = Math.round(amountUsdc * 100);
  return {
    paymentId: "pay_demo_" + Date.now(),
    info: {
      status: "requires_action",
      amount: {
        unit: "iso4217/USD",
        value: String(displayCents),
        display: {
          assetSymbol: "USDC",
          assetName: "USD Coin",
          decimals: 2,
          networkName: "Base",
        },
      },
      expiresAt: Math.floor(Date.now() / 1000) + 600,
      merchant: {
        name: "Turnkey Cafe",
      },
    },
    options: [
      {
        id: "opt_usdc_base",
        amount: {
          unit: "caip19/eip155:8453/" + USDC_BASE,
          value: String(tokenUnits),
          display: {
            assetSymbol: "USDC",
            assetName: "USD Coin",
            decimals: 6,
            networkName: "Base",
          },
        },
        etaS: 10,
      },
    ],
  };
}

/**
 * Build a USDC transfer transaction for signAndSendTransaction.
 * This is the ERC-20 transfer(address,uint256) call data.
 */
export function getMockTransactionParams(amountUsdc: number = 5): {
  to: string;
  value: string;
  data: string;
  tokenUnits: number;
} {
  const tokenUnits = Math.round(amountUsdc * 1e6);
  const transferSelector = "a9059cbb";
  const toAddressPadded = MERCHANT_ADDRESS.slice(2).toLowerCase().padStart(64, "0");
  const amountPadded = tokenUnits.toString(16).padStart(64, "0");

  return {
    to: USDC_BASE,
    value: "0",
    data: "0x" + transferSelector + toAddressPadded + amountPadded,
    tokenUnits,
  };
}

export { MERCHANT_ADDRESS, USDC_BASE };
