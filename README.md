# Turnkey Demo: WalletConnect Pay

## Introduction

This repository features a mobile wallet demo powered by Turnkey that integrates with WalletConnect Pay for merchant payments. Behind the scenes, it uses `[@turnkey/react-native-wallet-kit](https://www.npmjs.com/package/@turnkey/react-native-wallet-kit)` for embedded wallet management and signing, and `[@walletconnect/pay](https://www.npmjs.com/package/@walletconnect/pay)` for the payment protocol.

With Turnkey, the wallet handles authentication and EIP-712 signing — WalletConnect Pay handles everything else: transaction construction, gas sponsorship (via 7702 paymaster), and on-chain broadcast. The wallet never holds or spends native ETH for gas.

Each end-user's wallet is fully self-custodial: Turnkey creates a dedicated sub-organization per user with a 1-of-1 root quorum, meaning only the authenticated user can authorize signing. The parent organization cannot access sub-organization private keys. Turnkey acts as the secure wallet infrastructure — key generation and signing happen within Turnkey's secure enclaves, but control belongs entirely to the end-user.

## Demo



[https://github.com/user-attachments/assets/01af3375-9bd8-4063-851b-0a90e84a0e70](https://github.com/user-attachments/assets/01af3375-9bd8-4063-851b-0a90e84a0e70)



## Getting started

Make sure you have Node.js installed locally; we recommend using Node v20+.

```bash
$ node --version # v20+
$ git clone https://github.com/MarkoKey/with-wcpay.git
$ cd with-wcpay/
$ cp .env.example .env
# Fill in your Turnkey and WalletConnect credentials in .env
$ npm install
$ npx expo prebuild --platform ios
```

**Option 1 — CLI:**

```bash
$ npx expo run:ios
```

**Option 2 — Xcode:**

```bash
# In one terminal — start the Metro bundler
$ npx expo start

# In another terminal (or double-click the file)
$ open ios/WCPayTurnkeyDemo.xcworkspace
```

Then in Xcode: select a simulator from the device picker (e.g., iPhone 17 Pro) and press **⌘R**.

To configure the demo wallet you'll need the following:


| Variable                                   | Description                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID`      | Your Turnkey organization ID from the [Turnkey Dashboard](https://app.turnkey.com)                                                    |
| `EXPO_PUBLIC_TURNKEY_API_BASE_URL`         | Turnkey API base URL (default: `https://api.turnkey.com`)                                                                             |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID` | Auth Proxy configuration ID for email OTP — find it in the [Turnkey WalletKit Dashboard](https://app.turnkey.com/dashboard/walletKit) |
| `EXPO_PUBLIC_TURNKEY_RPID`                 | Relying Party ID for passkey domain                                                                                                   |
| `EXPO_PUBLIC_APP_SCHEME`                   | Deep link scheme for the app (default: `wcpaydemo`)                                                                                   |
| `EXPO_PUBLIC_WC_API_KEY`                   | WalletConnect Pay API key from the [WalletConnect Dashboard](https://dashboard.walletconnect.com/)                                    |


## WalletConnect Pay setup

1. Go to [dashboard.walletconnect.com](https://dashboard.walletconnect.com/) → create a new project → **select "Wallet" as the project type** (the WalletConnect Pay tab is not visible on App projects)
2. **WalletConnect Pay** tab → **API Keys** → generate a key → set it as `EXPO_PUBLIC_WC_API_KEY`
3. Under **TEST → Receiving addresses**, add your address in CAIP-10 format (e.g. `eip155:8453:0xYourAddress`)
4. Click **Go to POS App** → **New sale** → set an amount → a payment QR is generated

To get the payment link on the iOS simulator (no camera): open DevTools → Network tab → filter by `pay` → copy the `pay_...` ID and paste as:
```
https://pay.walletconnect.com/pay_<ID>
```

> **Note:** WalletConnect Pay is mainnet only — testnets are not supported. The payer's wallet needs real USDC on Base (or another [supported chain](https://docs.walletconnect.com/payments/wallets/overview)). Since you set your own address as the merchant recipient, payments go back to yourself — ~$1 USDC is enough to test.

## Technical tl;dr

`TurnkeyProvider` wraps the app at the root, providing auth state and a `signMessage` function to all screens:
[https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/app/_layout.tsx#L49-L52](https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/app/_layout.tsx#L49-L52)

`WalletConnectPay` is instantiated as a singleton client, initialized with your WalletConnect API key:
[https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/constants/walletconnect.ts#L8-L14](https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/constants/walletconnect.ts#L8-L14)

Payment actions from WC Pay are signed via Turnkey's `signMessage`, bridging the WC Pay RPC format to EIP-712 signatures:
[https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/lib/turnkey-signer.ts#L27-L105](https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/lib/turnkey-signer.ts#L27-L105)

The payment screen orchestrates the full flow — fetching options, identity verification, signing, and broadcast:
[https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/app/payment.tsx#L112-L130](https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/app/payment.tsx#L112-L130)

## How it works

```
User ──▶ Email OTP ──▶ Turnkey creates sub-org + ETH wallet
  │
  ▼
Scan WC Pay QR ──▶ Fetch payment options from WC Pay
  │
  ▼
Confirm payment ──▶ Identity verification (if required)
  │
  ▼
Turnkey signs EIP-712 ──▶ WC Pay broadcasts via 7702 paymaster ──▶ ✅ On-chain
```

1. User authenticates via email OTP — Turnkey creates a sub-organization with an Ethereum wallet
2. User scans a WalletConnect Pay QR code (or enters a payment link manually)
3. App fetches payment options from WC Pay and displays merchant info
4. If required, user completes identity verification (Travel Rule compliance) via WC Pay WebView
5. User confirms — Turnkey signs the payment authorization, WC Pay handles gas and broadcasts on-chain
6. Payment confirms — success screen

## Legal disclaimer

This demo is provided for testing and demonstration purposes only. It is not intended for production use. Use at your own risk.