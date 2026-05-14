# Turnkey Demo: WalletConnect Pay

## Introduction

This repository features a mobile wallet demo powered by Turnkey that integrates with WalletConnect Pay for merchant payments. Behind the scenes, it uses [`@turnkey/react-native-wallet-kit`](https://www.npmjs.com/package/@turnkey/react-native-wallet-kit) for embedded wallet management and signing, and [`@walletconnect/pay`](https://www.npmjs.com/package/@walletconnect/pay) for the payment protocol.

With Turnkey, the wallet handles authentication and EIP-712 signing — WalletConnect Pay handles everything else: transaction construction, gas sponsorship (via 7702 paymaster), and on-chain broadcast. The wallet never holds or spends native ETH for gas.

## Demo

<div align="center">

https://github.com/user-attachments/assets/01af3375-9bd8-4063-851b-0a90e84a0e70

</div>

## Getting started

Make sure you have Node.js installed locally; we recommend using Node v16+.

```bash
$ node --version # v16+
$ git clone https://github.com/MarkoKey/with-wcpay.git
$ cd with-wcpay/
$ cp .env.example .env
# Fill in your Turnkey and WalletConnect credentials in .env
$ npm install
$ npx expo prebuild --platform ios
$ npx expo run:ios
```

To configure the demo wallet you'll need the following:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID` | Your Turnkey organization ID from the [Turnkey Dashboard](https://app.turnkey.com) |
| `EXPO_PUBLIC_TURNKEY_API_BASE_URL` | Turnkey API base URL (default: `https://api.turnkey.com`) |
| `EXPO_PUBLIC_TURNKEY_AUTH_PROXY_CONFIG_ID` | Auth Proxy configuration ID for email OTP |
| `EXPO_PUBLIC_TURNKEY_RPID` | Relying Party ID for passkey domain |
| `EXPO_PUBLIC_APP_SCHEME` | Deep link scheme for the app (default: `wcpaydemo`) |
| `EXPO_PUBLIC_WC_API_KEY` | WalletConnect Pay API key from the [WalletConnect Dashboard](https://cloud.walletconnect.com/) |

## Technical tl;dr

`TurnkeyProvider` wraps the app at the root, providing auth state and a `signMessage` function to all screens:
https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/app/_layout.tsx#L49-L52

`WalletConnectPay` is instantiated as a singleton client, initialized with your WalletConnect API key:
https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/constants/walletconnect.ts#L8-L14

Payment actions from WC Pay are signed via Turnkey's `signMessage`, bridging the WC Pay RPC format to EIP-712 signatures:
https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/lib/turnkey-signer.ts#L27-L105

The payment screen orchestrates the full flow — fetching options, identity verification, signing, and broadcast:
https://github.com/MarkoKey/with-wcpay/blob/1c3fbdbfe59309aa41b984017b34316749c1d662/app/payment.tsx#L112-L130

## How it works

1. User authenticates via email OTP — Turnkey creates a sub-organization with an Ethereum wallet
2. User scans a WalletConnect Pay QR code (or enters a payment link manually)
3. App fetches payment options from WC Pay and displays merchant info
4. If required, user completes identity verification (Travel Rule compliance) via WC Pay WebView
5. User confirms — Turnkey signs the payment authorization, WC Pay handles gas and broadcasts on-chain
6. Payment confirms — success screen

## Legal disclaimer

This demo is provided for testing and demonstration purposes only. It is not intended for production use. Use at your own risk.
