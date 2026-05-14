# WalletConnect Pay + Turnkey Demo

A React Native mobile wallet demo that integrates [WalletConnect Pay](https://docs.walletconnect.com/payments/wallets/standalone/react-native) with [Turnkey](https://turnkey.com) embedded wallets. Turnkey handles authentication and signing; WalletConnect Pay handles transaction construction, gas (via 7702 paymaster), and broadcast.

Users authenticate via email OTP, create a Turnkey-secured wallet, scan a merchant QR code, and pay with USDC on Base — with gas handled by WalletConnect Pay's paymaster. The wallet never holds or spends native ETH for gas.

## Demo

<video src="assets/WCPay Turnkey Demo.mp4" width="300" autoplay loop muted></video>

## Features

- **Email OTP authentication** via Turnkey Auth Proxy
- **Turnkey embedded wallet** — non-custodial, keys managed via secure enclave
- **WalletConnect Pay merchant payment flow** — QR scan, identity verification, confirm, pay
- **Gas handled by WalletConnect Pay** via 7702 paymaster — no native ETH required
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
│  WC Pay QR   │                   ▼
│  (merchant)  │            ┌──────────────┐
└──────┬───────┘            │   Turnkey     │
       │                    │   Signing     │
       │  Confirm           └──────┬───────┘
       ▼                           │
┌─────────────┐                    │  Signatures
│  Payment     │ ── sign ────────▶ │
│  Screen      │                   │
└──────┬───────┘                   ▼
       │                    ┌──────────────┐
       │  Signatures        │  WC Pay      │
       │──────────────────▶ │  Backend     │
       │                    │  (gas + tx)  │
       │                    └──────┬───────┘
       │                           │
       │                           ▼
       │                    ┌──────────────┐
       │  Result             │   Base L2     │
       ◀────────────────────│  (on-chain)   │
       │                    └──────────────┘
       ▼
   ✅ Success
```

**Flow:**

1. User authenticates via email OTP — Turnkey creates a sub-organization with an Ethereum wallet
2. User scans a WalletConnect Pay QR code (or enters a payment link manually)
3. App fetches payment options from WC Pay and displays merchant info
4. If required, user completes identity verification (Travel Rule compliance) via WC Pay WebView
5. User confirms — Turnkey signs the payment authorization, WC Pay handles gas and broadcasts on-chain
6. Payment confirms — success screen

## Tech Stack

| Technology | Purpose |
|---|---|
| [React Native](https://reactnative.dev/) (Expo) | Mobile app framework |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe development |
| [@turnkey/react-native-wallet-kit](https://www.npmjs.com/package/@turnkey/react-native-wallet-kit) | Embedded wallet, auth, signing |
| [@walletconnect/pay](https://www.npmjs.com/package/@walletconnect/pay) | Payment protocol, gas, broadcast |
| [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) | QR code scanning |
| [react-native-webview](https://github.com/nicejobinc/react-native-webview) | Identity verification flow |

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
| `EXPO_PUBLIC_WC_API_KEY` | WalletConnect Pay API key from the [WalletConnect Dashboard](https://cloud.walletconnect.com/) |

## Project Structure

```
app/
├── _layout.tsx              # Root layout, TurnkeyProvider, auth gate
├── index.tsx                # Login screen (email OTP)
├── scanner.tsx              # QR code scanner + manual link entry
├── payment.tsx              # Payment flow: options, IC, signing, confirm
└── (main)/
    ├── _layout.tsx          # Tab layout
    └── index.tsx            # Home screen (wallet info, balance, scan to pay)

lib/
└── turnkey-signer.ts        # WC Pay RPC → Turnkey signMessage bridge

constants/
├── turnkey.ts               # Turnkey provider configuration
├── walletconnect.ts         # WC Pay client, URL normalization, accounts
└── theme.ts                 # Color theme constants
```

## Legal Disclaimer

This demo is provided for testing and demonstration purposes only. It is not intended for production use. Use at your own risk.
