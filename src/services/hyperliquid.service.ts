import type {
  HyperLiquidTrade,
  HyperLiquidSpotTrade,
  HyperLiquidUserState,
  HyperLiquidSpotUserState,
  HyperLiquidFundingEntry,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedFunding,
  NormalizedSpotBalance,
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

// Perp endpoints
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

// Spot endpoints
async function getSpotUserState(wallet: string): Promise<HyperLiquidSpotUserState> {
  const result = await makeHyperLiquidRequest<HyperLiquidSpotUserState>({
    type: "spotClearinghouseState",
    user: wallet,
  });
  return result;
}

async function getSpotUserFills(
  wallet: string,
  startTime?: number,
  endTime?: number
): Promise<HyperLiquidSpotTrade[]> {
  const result = await makeHyperLiquidRequest<HyperLiquidSpotTrade[]>({
    type: "userFillsByTime",
    user: wallet,
    ...(startTime !== undefined && { startTime }),
    ...(endTime !== undefined && { endTime }),
  });
  // Filter to only spot trades (they have "/" in the coin name like "PURR/USDC")
  return result.filter((trade) => trade.coin.includes("/"));
}

// Normalization functions
function normalizePerpTrade(trade: HyperLiquidTrade): NormalizedTrade {
  return {
    coin: trade.coin,
    side: trade.side === "B" ? "buy" : "sell",
    price: parseFloat(trade.px),
    size: parseFloat(trade.sz),
    timestamp: new Date(trade.time),
    fee: parseFloat(trade.fee),
    closedPnl: trade.closedPnl ? parseFloat(trade.closedPnl) : 0,
    market: "perp",
  };
}

function normalizeSpotTrade(trade: HyperLiquidSpotTrade): NormalizedTrade {
  // For spot, we calculate realized PnL differently
  // closedPnl is 0 for spot since there's no leverage/funding
  return {
    coin: trade.coin.split("/")[0] ?? trade.coin, // Extract base asset (e.g., "PURR" from "PURR/USDC")
    side: trade.side === "B" ? "buy" : "sell",
    price: parseFloat(trade.px),
    size: parseFloat(trade.sz),
    timestamp: new Date(trade.time),
    fee: parseFloat(trade.fee),
    closedPnl: 0, // Spot PnL calculated from balance changes
    market: "spot",
  };
}

function normalizePerpPosition(position: HyperLiquidUserState["assetPositions"][number]["position"]): NormalizedPosition {
  return {
    coin: position.coin,
    size: parseFloat(position.szi),
    entryPrice: parseFloat(position.entryPx),
    unrealizedPnl: parseFloat(position.unrealizedPnl),
    positionValue: parseFloat(position.positionValue),
    market: "perp",
  };
}

function normalizeSpotBalance(balance: HyperLiquidSpotUserState["balances"][number], spotPrices: Map<string, number>): NormalizedSpotBalance {
  const total = parseFloat(balance.total);
  const hold = parseFloat(balance.hold);
  const entryNotional = parseFloat(balance.entryNtl);
  const currentPrice = spotPrices.get(balance.coin) ?? 0;
  const currentValue = total * currentPrice;
  const unrealizedPnl = currentValue - entryNotional;

  return {
    coin: balance.coin,
    total,
    hold,
    available: total - hold,
    entryNotional,
    currentValue,
    unrealizedPnl,
  };
}

function normalizeFunding(funding: HyperLiquidFundingEntry): NormalizedFunding {
  return {
    coin: funding.coin,
    amount: parseFloat(funding.usdc),
    timestamp: new Date(funding.time),
  };
}

// Calculate spot realized PnL from trades
function calculateSpotRealizedPnl(trades: NormalizedTrade[]): number {
  // Group trades by coin to calculate FIFO-based PnL
  const spotTrades = trades.filter((t) => t.market === "spot");
  
  // Simple approach: sum up (sell_value - buy_value) for completed round trips
  // This is a simplified calculation - a full implementation would use FIFO/LIFO
  const coinTrades = new Map<string, { buys: number; sells: number; buyValue: number; sellValue: number }>();
  
  for (const trade of spotTrades) {
    const existing = coinTrades.get(trade.coin) ?? { buys: 0, sells: 0, buyValue: 0, sellValue: 0 };
    const tradeValue = trade.price * trade.size;
    
    if (trade.side === "buy") {
      existing.buys += trade.size;
      existing.buyValue += tradeValue;
    } else {
      existing.sells += trade.size;
      existing.sellValue += tradeValue;
    }
    
    coinTrades.set(trade.coin, existing);
  }
  
  // Calculate realized PnL for matched trades
  let realizedPnl = 0;
  for (const [, data] of coinTrades) {
    const matchedSize = Math.min(data.buys, data.sells);
    if (matchedSize > 0 && data.buys > 0 && data.sells > 0) {
      const avgBuyPrice = data.buyValue / data.buys;
      const avgSellPrice = data.sellValue / data.sells;
      realizedPnl += matchedSize * (avgSellPrice - avgBuyPrice);
    }
  }
  
  return realizedPnl;
}

export interface WalletData {
  trades: NormalizedTrade[];
  positions: NormalizedPosition[];
  spotBalances: NormalizedSpotBalance[];
  fundingPayments: NormalizedFunding[];
  accountValue: number;
  spotAccountValue: number;
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
    // Fetch all data in parallel (perp + spot)
    const [userState, spotUserState, perpFills, spotFills, funding] = await Promise.all([
      getUserState(wallet),
      getSpotUserState(wallet).catch(() => ({ balances: [] })), // Graceful fallback if no spot
      getUserFills(wallet, startTime, endTime),
      getSpotUserFills(wallet, startTime, endTime).catch(() => []), // Graceful fallback
      getUserFunding(wallet, startTime, endTime),
    ]);

    // Normalize perp data
    const perpTrades = perpFills.map(normalizePerpTrade);
    const perpPositions = userState.assetPositions.map((ap) => normalizePerpPosition(ap.position));
    const fundingPayments = funding.map(normalizeFunding);
    const perpAccountValue = parseFloat(userState.marginSummary.accountValue);

    // Normalize spot data
    const spotTrades = spotFills.map(normalizeSpotTrade);
    
    // For spot balances, we need current prices - use a simple approach
    // In production, you'd fetch spot prices from HyperLiquid's spot meta endpoint
    const spotPrices = new Map<string, number>();
    // Estimate prices from recent trades
    for (const trade of spotTrades) {
      spotPrices.set(trade.coin, trade.price);
    }
    
    const spotBalances = spotUserState.balances
      .filter((b) => parseFloat(b.total) > 0)
      .map((b) => normalizeSpotBalance(b, spotPrices));
    
    const spotAccountValue = spotBalances.reduce((sum, b) => sum + b.currentValue, 0);

    // Combine all trades
    const allTrades = [...perpTrades, ...spotTrades];

    logger.info("Wallet data fetched", {
      wallet,
      perpTradesCount: perpTrades.length,
      spotTradesCount: spotTrades.length,
      perpPositionsCount: perpPositions.length,
      spotBalancesCount: spotBalances.length,
      fundingCount: fundingPayments.length,
    });

    return {
      trades: allTrades,
      positions: perpPositions,
      spotBalances,
      fundingPayments,
      accountValue: perpAccountValue,
      spotAccountValue,
    };
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    logger.error("Failed to fetch wallet data", { wallet, error });
    throw new ExternalApiError("Failed to fetch wallet data from HyperLiquid");
  }
}

// Export for use in PnL calculation
export { calculateSpotRealizedPnl };
