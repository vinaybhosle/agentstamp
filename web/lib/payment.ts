/**
 * AgentStamp in-browser paid stamp checkout.
 *
 * All wallet/crypto operations are dynamically imported so that:
 *  - SSR never fails (no window.ethereum access at build time)
 *  - If a user has no injected wallet, a clear error surfaces
 *  - The rest of the page still renders normally
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StampTier = "bronze" | "silver" | "gold";

export interface StampResult {
  id: string;
  tier: StampTier;
  expires_at: string;
  certificate: string;
  signature: string;
  verify_url: string;
}

export interface WalletConnection {
  address: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any; // viem WalletClient — typed as any to avoid deep viem types at boundary
}

export interface AgentStampHeaders {
  "x-wallet-address": string;
  "x-wallet-timestamp": string;
  "x-wallet-signature": string;
}

export interface PayAndMintParams {
  tier: StampTier;
  name?: string;
  apiBase: string;
  /**
   * Hard ceiling (USDC base units, 6 decimals) on what the x402 layer may
   * authorize for THIS request. Must be the exact tier price so a malformed or
   * spoofed 402 response cannot charge more than the user agreed to.
   * bronze=1000 ($0.001), silver=5000 ($0.005), gold=10000 ($0.01).
   */
  maxValueUsdc: bigint;
}

// ---------------------------------------------------------------------------
// Typed error classes
// ---------------------------------------------------------------------------

export class NoWalletError extends Error {
  readonly kind = "no-wallet" as const;
  constructor() {
    super(
      "No injected wallet found. Install MetaMask or another EVM wallet extension."
    );
    this.name = "NoWalletError";
  }
}

export class UserRejectedError extends Error {
  readonly kind = "user-rejected" as const;
  constructor(msg?: string) {
    super(msg ?? "User rejected the wallet request.");
    this.name = "UserRejectedError";
  }
}

export class PaymentFailedError extends Error {
  readonly kind = "payment-failed" as const;
  constructor(msg?: string) {
    super(msg ?? "x402 payment failed.");
    this.name = "PaymentFailedError";
  }
}

export class BackendError extends Error {
  readonly kind = "backend-error" as const;
  readonly statusCode: number;
  constructor(msg: string, statusCode: number) {
    super(msg);
    this.name = "BackendError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Canonical JSON helper (mirrors server-side sortKeysDeep + JSON.stringify)
// ---------------------------------------------------------------------------

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function sortKeysDeep(obj: JsonValue): JsonValue {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === "object") {
    const sorted: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysDeep((obj as { [key: string]: JsonValue })[key]);
    }
    return sorted;
  }
  return obj;
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashRequestBody(
  body: Record<string, JsonValue>
): Promise<string | null> {
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return null;
  }
  const canonical = JSON.stringify(sortKeysDeep(body));
  return sha256Hex(canonical);
}

// ---------------------------------------------------------------------------
// connectWallet — requests accounts and builds a viem wallet client
// ---------------------------------------------------------------------------

export async function connectWallet(): Promise<WalletConnection> {
  // Guard: SSR / no window
  if (typeof window === "undefined") {
    throw new NoWalletError();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ethereum = (window as unknown as { ethereum?: any }).ethereum;

  if (!ethereum) {
    throw new NoWalletError();
  }

  // Dynamic import: viem only in browser
  const { createWalletClient, custom } = await import("viem");
  const { base } = await import("viem/chains");

  let accounts: string[];
  try {
    accounts = (await ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
  } catch (err: unknown) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 4001
    ) {
      throw new UserRejectedError("You rejected the wallet connection request.");
    }
    throw new UserRejectedError(
      err instanceof Error ? err.message : "Wallet connection failed."
    );
  }

  if (!accounts || accounts.length === 0) {
    throw new UserRejectedError("No accounts returned from wallet.");
  }

  const address = accounts[0];

  // Ensure the wallet is actually on Base (chainId 8453 = 0x2105). Without this,
  // a wallet on Ethereum mainnet would sign/broadcast the USDC payment on the
  // wrong chain. Switch (and add if unknown) before building the client.
  const BASE_CHAIN_ID_HEX = "0x2105";
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (switchErr: unknown) {
    const code =
      switchErr !== null && typeof switchErr === "object" && "code" in switchErr
        ? (switchErr as { code: number }).code
        : undefined;
    if (code === 4902) {
      // Base not yet added to the wallet — add it, then it becomes the active chain.
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: BASE_CHAIN_ID_HEX,
              chainName: "Base",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.base.org"],
              blockExplorerUrls: ["https://basescan.org"],
            },
          ],
        });
      } catch (addErr: unknown) {
        throw new UserRejectedError(
          "Could not switch your wallet to the Base network. Switch to Base and try again."
        );
      }
    } else if (code === 4001) {
      throw new UserRejectedError("You declined switching to the Base network.");
    } else {
      throw new UserRejectedError(
        "Could not switch your wallet to the Base network. Switch to Base and try again."
      );
    }
  }

  const walletClient = createWalletClient({
    account: address as `0x${string}`,
    chain: base,
    transport: custom(ethereum),
  });

  return { address, walletClient };
}

// ---------------------------------------------------------------------------
// signAgentStampAction — builds the three x-wallet-* headers
// ---------------------------------------------------------------------------

export async function signAgentStampAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any,
  address: string,
  action: string,
  body: Record<string, JsonValue>
): Promise<AgentStampHeaders> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = await hashRequestBody(body);

  // Message mirrors server-side buildSignatureMessage exactly
  const message =
    bodyHash !== null
      ? `AgentStamp:${action}:${timestamp}:${bodyHash}`
      : `AgentStamp:${action}:${timestamp}`;

  let signature: string;
  try {
    // viem walletClient.signMessage uses EIP-191 personal_sign
    signature = await walletClient.signMessage({ message });
  } catch (err: unknown) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 4001
    ) {
      throw new UserRejectedError("You rejected the signature request.");
    }
    throw new UserRejectedError(
      err instanceof Error ? err.message : "Signature failed."
    );
  }

  return {
    "x-wallet-address": address,
    "x-wallet-timestamp": timestamp,
    "x-wallet-signature": signature,
  };
}

// ---------------------------------------------------------------------------
// payAndMintStamp — full payment + mint flow
// ---------------------------------------------------------------------------

export async function payAndMintStamp({
  tier,
  name,
  apiBase,
  maxValueUsdc,
}: PayAndMintParams): Promise<StampResult> {
  // 1. Connect wallet
  const { address, walletClient } = await connectWallet();

  // 2. Build request body
  const body: Record<string, JsonValue> = {};
  if (name) body.name = name;

  // 3. Sign AgentStamp headers
  const agentStampHeaders = await signAgentStampAction(
    walletClient,
    address,
    "mint",
    body
  );

  // 4. Build x402-wrapped fetch (dynamic import, browser only)
  const { wrapFetchWithPayment } = await import("x402-fetch");

  // x402-fetch Signer = viem WalletClient, which walletClient already is.
  // Cap authorization at the exact tier price (not a blanket gold ceiling) so a
  // malformed/spoofed 402 cannot charge more than the user agreed to for this tier.
  const fetchWithPay = wrapFetchWithPayment(
    globalThis.fetch,
    walletClient,
    maxValueUsdc
  );

  // 5. Call mint endpoint
  const url = `${apiBase}/api/v1/stamp/mint/${tier}`;
  let res: Response;
  try {
    res = await fetchWithPay(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...agentStampHeaders,
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("reject") || msg.includes("4001")) {
      throw new UserRejectedError(msg);
    }
    throw new PaymentFailedError(msg);
  }

  // 6. Parse response
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new BackendError("Server returned invalid JSON.", res.status);
  }

  if (!res.ok || res.status !== 201) {
    const errMsg =
      data !== null &&
      typeof data === "object" &&
      "error" in (data as object)
        ? String((data as { error: unknown }).error)
        : `Server error ${res.status}`;
    throw new BackendError(errMsg, res.status);
  }

  const payload = data as {
    success: boolean;
    stamp: StampResult;
  };

  if (!payload.success || !payload.stamp) {
    throw new BackendError("Unexpected response structure from server.", 200);
  }

  return payload.stamp;
}
