# WalletConnect Pay + Turnkey Demo

A React Native mobile wallet demo that integrates [WalletConnect Pay](https://docs.walletconnect.com/payments/wallets/standalone/react-native) with [Turnkey](https://turnkey.com) embedded wallets for gasless USDC payments on Base.

This demo showcases a mobile payment flow where users authenticate via email OTP, create a Turnkey-managed embedded wallet, scan a merchant QR code, and pay with USDC on Base — with gas fees fully sponsored by Turnkey. The wallet never holds or spends native ETH for gas.

## Demo

<!-- Replace with your screen recording -->
> Video demo coming soon

## Features

- **Email OTP authentication** via Turnkey Auth Proxy
- **Turnkey embedded wallet** — non-custodial, secure enclave key management
- **WalletConnect Pay merchant payment flow** — QR scan, confirm, pay
- **Gasless USDC transfers** on Base via Turnkey sponsored transactions
- **Real on-chain ERC-20 transfers** with transaction hash confirmation
- **Dark mode UI**

## Architecture

```
┌─────────────┐    OTP     ┌──────────────┐
│  Mobile App  │ ────────▶ │   Turnkey     │
│  (Expo/RN)   │ ◀──────── │  Auth Proxy   │
└──────┬───────┘  Session   └──────┬───────┘
       │                           │
       │  Scan QR                  │  Creates sub-org
       ▼                           │  + ETH wallet
┌─────────────┐                    │
│  WC Pay QR   │                   │
│  (merchant)  │                   ▼
└──────┬───────┘            ┌──────────────┐
       │                    │   Turnkey     │
       │  Confirm           │  Signing &    │
       ▼                    │  Sponsoring   │
┌─────────────┐             └──────┬───────┘
│  Payment     │                   │
│  Screen      │ ─── sign+send ──▶│
└──────┬───────┘                   │
       │                           ▼
       │                    ┌──────────────┐
       │  tx hash           │   Base L2     │
       ◀────────────────────│  (on-chain)   │
       │                    └──────────────┘
       ▼
   ✅ Success
```

**Flow:**

1. User authenticates via email OTP — Turnkey creates a sub-organization with an Ethereum wallet
2. User scans a WalletConnect Pay QR code (or enters a payment link manually)
3. App displays merchant info and payment amount
4. User confirms — Turnkey constructs, signs, sponsors gas, and broadcasts the USDC transfer on Base
5. Transaction confirms on-chain — success screen with tx hash

## Tech Stack

| Technology | Purpose |
|---|---|
| [React Native](https://reactnative.dev/) (Expo) | Mobile app framework |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe development |
| [@turnkey/react-native-wallet-kit](https://www.npmjs.com/package/@turnkey/react-native-wallet-kit) | Embedded wallet, auth, signing |
| [@walletconnect/pay](https://www.npmjs.com/package/@walletconnect/pay) | Merchant payment protocol |
| Turnkey Sponsored Transactions | Gasless transfers on Base |
| [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) | QR code scanning |
| [viem](https://viem.sh/) | EIP-712 utilities |

## Getting Started

### Prerequisites

- Node.js v16+
- Xcode with iOS Simulator (macOS)
- A [Turnkey](https://app.turnkey.com) account with Auth Proxy enabled
- A [WalletConnect Dashboard](https://cloud.walletconnect.com/) project

### Setup

```bash
git clone https://github.com/MarkoKey/wcpay-turnkey-demo.git
cd wcpay-turnkey-demo
cp .env.example .env
# Fill in your Turnkey and WalletConnect credentials in .env
npm install
npx expo prebuild --platform ios
npx expo run:ios
```

### Configuration

Create a `.env` file (or copy from `.env.example`) with the following variables:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID` | Your Turnkey organization ID from the [Turnkey Dashboard](https://app.turnkey.com) |
| `EXPO_PUBLIC_TURNKEY_API_BASE_URL` | Turnkey API base URL (default: `https://api.turnkey.com`) |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID` | Auth Proxy configuration ID for email OTP |
| `EXPO_PUBLIC_TURNKEY_RPID` | Relying Party ID for passkey domain |
| `EXPO_PUBLIC_APP_SCHEME` | Deep link scheme for the app (default: `wcpaydemo`) |
| `EXPO_PUBLIC_WC_APP_ID` | WalletConnect project ID from the [WalletConnect Dashboard](https://cloud.walletconnect.com/) |

## Project Structure

```
app/
├── _layout.tsx              # Root layout, TurnkeyProvider, auth gate
├── index.tsx                # Login screen (email OTP)
├── scanner.tsx              # QR code scanner + manual link entry
├── payment.tsx              # Payment confirmation, Turnkey signing, success
└── (main)/
    ├── _layout.tsx          # Tab layout
    └── index.tsx            # Home screen (wallet info, balance, scan to pay)

lib/
└── mock-wc-pay.ts           # Mock WC Pay merchant service for demo

constants/
├── turnkey.ts               # Turnkey provider configuration
├── walletconnect.ts         # WalletConnect Pay client setup
└── theme.ts                 # Color theme constants
```

## Legal Disclaimer

This demo is provided for testing and demonstration purposes only. It is not intended for production use. Use at your own risk.
