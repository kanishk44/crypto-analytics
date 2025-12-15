import type {
  HyperLiquidTrade,
  HyperLiquidUserState,
  HyperLiquidFundingEntry,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedFunding,
} from "../types/hyperliquid.ts";
import { ExternalApiError } from "../types/errors.ts";
import { logger } from "../utils/logger.ts";
import { getDayBounds } from "../utils/dateRange.ts";

const HYPERLIQUID_API_URL = "https://api.hyperliquid.xyz/info";

interface HyperLiquidRequest {
  type: string;
  user?: string;
  startTime?: number;
  endTime?: number;
}

async function makeHyperLiquidRequest<T>(payload: HyperLiquidRequest): Promise<T> {
  const startTime = Date.now();

  try {
    const response = await fetch(HYPERLIQUID_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const duration = Date.now() - startTime;
    logger.info("HyperLiquid API response", { type: payload.type, status: response.status, duration });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new ExternalApiError(`HyperLiquid API error: ${response.status}`, { errorText });
    }

    const data = await response.json() as T;
    return data;
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    logger.error("HyperLiquid request failed", { type: payload.type, error });
    throw new ExternalApiError("Failed to connect to HyperLiquid API");
  }
}

async function getUserState(wallet: string): Promise<HyperLiquidUserState> {
  const result = await makeHyperLiquidRequest<HyperLiquidUserState>({
    type: "clearinghouseState",
    user: wallet,
  });
  return result;
}

async function getUserFills(
  wallet: string,
  startTime?: number,
  endTime?: number
): Promise<HyperLiquidTrade[]> {
  const result = await makeHyperLiquidRequest<HyperLiquidTrade[]>({
    type: "userFills",
    user: wallet,
    ...(startTime !== undefined && { startTime }),
    ...(endTime !== undefined && { endTime }),
  });
  return result;
}

async function getUserFunding(
  wallet: string,
  startTime?: number,
  endTime?: number
): Promise<HyperLiquidFundingEntry[]> {
  const result = await makeHyperLiquidRequest<HyperLiquidFundingEntry[]>({
    type: "userFunding",
    user: wallet,
    ...(startTime !== undefined && { startTime }),
    ...(endTime !== undefined && { endTime }),
  });
  return result;
}

function normalizeTrade(trade: HyperLiquidTrade): NormalizedTrade {
  return {
    coin: trade.coin,
    side: trade.side === "B" ? "buy" : "sell",
    price: parseFloat(trade.px),
    size: parseFloat(trade.sz),
    timestamp: new Date(trade.time),
    fee: parseFloat(trade.fee),
    closedPnl: trade.closedPnl ? parseFloat(trade.closedPnl) : 0,
  };
}

function normalizePosition(position: HyperLiquidUserState["assetPositions"][number]["position"]): NormalizedPosition {
  return {
    coin: position.coin,
    size: parseFloat(position.szi),
    entryPrice: parseFloat(position.entryPx),
    unrealizedPnl: parseFloat(position.unrealizedPnl),
    positionValue: parseFloat(position.positionValue),
  };
}

function normalizeFunding(funding: HyperLiquidFundingEntry): NormalizedFunding {
  return {
    coin: funding.coin,
    amount: parseFloat(funding.usdc),
    timestamp: new Date(funding.time),
  };
}

export interface WalletData {
  trades: NormalizedTrade[];
  positions: NormalizedPosition[];
  fundingPayments: NormalizedFunding[];
  accountValue: number;
}

export async function fetchWalletData(
  wallet: string,
  start: string,
  end: string
): Promise<WalletData> {
  logger.info("Fetching wallet data from HyperLiquid", { wallet, start, end });

  const { start: startTime } = getDayBounds(start);
  const { end: endTime } = getDayBounds(end);

  try {
    // Fetch all data in parallel
    const [userState, fills, funding] = await Promise.all([
      getUserState(wallet),
      getUserFills(wallet, startTime, endTime),
      getUserFunding(wallet, startTime, endTime),
    ]);

    // Normalize the data
    const trades = fills.map(normalizeTrade);
    const positions = userState.assetPositions.map((ap) => normalizePosition(ap.position));
    const fundingPayments = funding.map(normalizeFunding);
    const accountValue = parseFloat(userState.marginSummary.accountValue);

    logger.info("Wallet data fetched", {
      wallet,
      tradesCount: trades.length,
      positionsCount: positions.length,
      fundingCount: fundingPayments.length,
    });

    return {
      trades,
      positions,
      fundingPayments,
      accountValue,
    };
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    logger.error("Failed to fetch wallet data", { wallet, error });
    throw new ExternalApiError("Failed to fetch wallet data from HyperLiquid");
  }
}

