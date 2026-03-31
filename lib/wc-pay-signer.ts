/**
 * WalletConnect Pay ↔ Turnkey Signing Bridge
 *
 * WC Pay returns RPC actions with methods like:
 *   - eth_signTypedData_v4  (Permit2 signatures — most common)
 *   - eth_sendTransaction   (token approvals)
 *   - personal_sign         (message signatures)
 *
 * This module routes each to the appropriate Turnkey signing method.
 *
 * For eth_signTypedData_v4: We hash the EIP-712 typed data and use
 *   Turnkey's signRawPayload with HASH_FUNCTION_NO_OP (data is pre-hashed).
 *
 * For personal_sign: We use Turnkey's signMessage from the wallet kit.
 *
 * For eth_sendTransaction: We use Turnkey's signAndSendTransaction or
 *   sponsored transaction endpoint.
 */

import { hashTypedData, hashMessage as viemHashMessage } from "viem";

// Types matching WC Pay's action structure
export interface WalletRpcAction {
  chainId: string; // CAIP-2 format, e.g. "eip155:8453"
  method: string;
  params: string; // JSON-encoded
}

export interface SigningContext {
  // From useTurnkey() hook
  signMessage: (params: {
    walletAccount: any;
    message: string;
  }) => Promise<any>;
  signRawPayload: (params: {
    signWith: string;
    payload: string;
    encoding: string;
    hashFunction: string;
  }) => Promise<any>;
  signAndSendTransaction?: (params: any) => Promise<any>;
  walletAccount: any; // The user's Ethereum wallet account
  walletAddress: string; // The 0x address
}

/**
 * Sign a single WC Pay action using Turnkey.
 * Returns the hex signature string expected by WC Pay's confirmPayment.
 */
export async function signWcPayAction(
  action: WalletRpcAction,
  ctx: SigningContext
): Promise<string> {
  const { method, params } = action;
  const parsedParams = JSON.parse(params);

  switch (method) {
    case "eth_signTypedData_v4":
      return await signTypedDataV4(parsedParams, ctx);

    case "personal_sign":
      return await personalSign(parsedParams, ctx);

    case "eth_sendTransaction":
      return await sendTransaction(parsedParams, action.chainId, ctx);

    default:
      throw new Error(`Unsupported WC Pay RPC method: ${method}`);
  }
}

/**
 * Sign all WC Pay actions in order. Returns signatures array.
 */
export async function signAllWcPayActions(
  actions: { walletRpc: WalletRpcAction }[],
  ctx: SigningContext
): Promise<string[]> {
  const signatures: string[] = [];

  // Sign sequentially to maintain order (required by WC Pay)
  for (const action of actions) {
    const sig = await signWcPayAction(action.walletRpc, ctx);
    signatures.push(sig);
  }

  return signatures;
}

// ─── Internal handlers ───────────────────────────────────────────────────────

/**
 * eth_signTypedData_v4 handler
 *
 * WC Pay sends params as [address, typedDataJSON].
 * We hash the EIP-712 data using viem, then sign the hash via Turnkey's
 * signRawPayload with HASH_FUNCTION_NO_OP since we pre-hashed it.
 */
async function signTypedDataV4(
  parsedParams: any[],
  ctx: SigningContext
): Promise<string> {
  // params format: [signerAddress, typedDataJsonString]
  const typedDataInput =
    typeof parsedParams[1] === "string"
      ? JSON.parse(parsedParams[1])
      : parsedParams[1];

  // Hash the EIP-712 typed data using viem
  const hash = hashTypedData({
    domain: typedDataInput.domain,
    types: typedDataInput.types,
    primaryType: typedDataInput.primaryType,
    message: typedDataInput.message,
  });

  // Remove 0x prefix for Turnkey — it expects hex without prefix
  const payload = hash.slice(2);

  const result = await ctx.signRawPayload({
    signWith: ctx.walletAddress,
    payload,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });

  // Turnkey returns { r, s, v } — assemble into a 65-byte hex signature
  return assembleSignature(result);
}

/**
 * personal_sign handler
 *
 * WC Pay sends params as [messageHex, signerAddress].
 * We use Turnkey's signMessage which handles the EIP-191 prefix internally.
 */
async function personalSign(
  parsedParams: any[],
  ctx: SigningContext
): Promise<string> {
  // params format: [messageHex, signerAddress]
  const messageHex = parsedParams[0];

  // Convert hex message to string if it starts with 0x
  let message: string;
  if (messageHex.startsWith("0x")) {
    const bytes = Buffer.from(messageHex.slice(2), "hex");
    message = bytes.toString("utf8");
  } else {
    message = messageHex;
  }

  // Hash the message with EIP-191 prefix using viem
  const hash = viemHashMessage(message);
  const payload = hash.slice(2);

  const result = await ctx.signRawPayload({
    signWith: ctx.walletAddress,
    payload,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NO_OP",
  });

  return assembleSignature(result);
}

/**
 * eth_sendTransaction handler
 *
 * This is used when the user needs to approve a token (e.g., USDC approval
 * for Permit2). We'll use Turnkey's sponsored transaction on Base when possible.
 *
 * Returns the transaction hash.
 */
async function sendTransaction(
  parsedParams: any[],
  chainId: string,
  ctx: SigningContext
): Promise<string> {
  const txParams = parsedParams[0];

  // For now, we use signAndSendTransaction from the wallet kit
  // In production, this would route through Turnkey's sponsored tx endpoint
  // for gasless UX on Base
  if (ctx.signAndSendTransaction) {
    const result = await ctx.signAndSendTransaction({
      walletAccount: ctx.walletAccount,
      unsignedTransaction: txParams,
    });
    return result; // tx hash
  }

  throw new Error(
    "eth_sendTransaction: signAndSendTransaction not available in context"
  );
}

/**
 * Assemble a Turnkey {r, s, v} signature into a 0x-prefixed hex string.
 * WC Pay expects standard Ethereum signature format (65 bytes).
 */
function assembleSignature(result: { r: string; s: string; v: string }): string {
  // Turnkey returns r, s as hex strings (without 0x) and v as a decimal string
  const r = result.r.padStart(64, "0");
  const s = result.s.padStart(64, "0");

  // v should be 27 or 28 (or 0/1 which we convert)
  let vNum = parseInt(result.v, 10);
  if (vNum < 27) {
    vNum += 27;
  }
  const v = vNum.toString(16).padStart(2, "0");

  return `0x${r}${s}${v}`;
}
