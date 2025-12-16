import type { DailyPnl, DailyMarketPnl } from "../types/pnl.ts";
import type { WalletData } from "./hyperliquid.service.ts";
import { calculateSpotRealizedPnl } from "./hyperliquid.service.ts";
import type { NormalizedTrade, NormalizedFunding } from "../types/hyperliquid.ts";
import { formatDate } from "../utils/dateRange.ts";

interface DayData {
  perpTrades: NormalizedTrade[];
  spotTrades: NormalizedTrade[];
  funding: NormalizedFunding[];
}

function groupByDate(walletData: WalletData): Map<string, DayData> {
  const grouped = new Map<string, DayData>();

  // Group trades by date and market type
  for (const trade of walletData.trades) {
    const date = formatDate(trade.timestamp);
    const existing = grouped.get(date) ?? { perpTrades: [], spotTrades: [], funding: [] };
    
    if (trade.market === "perp") {
      existing.perpTrades.push(trade);
    } else {
      existing.spotTrades.push(trade);
    }
    
    grouped.set(date, existing);
  }

  // Group funding by date (funding is perp-only)
  for (const fund of walletData.fundingPayments) {
    const date = formatDate(fund.timestamp);
    const existing = grouped.get(date) ?? { perpTrades: [], spotTrades: [], funding: [] };
    existing.funding.push(fund);
    grouped.set(date, existing);
  }

  return grouped;
}

function calculatePerpRealizedPnl(trades: NormalizedTrade[]): number {
  return trades.reduce((sum, trade) => sum + trade.closedPnl, 0);
}

function calculateDayFees(trades: NormalizedTrade[]): number {
  return trades.reduce((sum, trade) => sum + trade.fee, 0);
}

function calculateDayFunding(funding: NormalizedFunding[]): number {
  return funding.reduce((sum, f) => sum + f.amount, 0);
}

export function calculateDailyPnl(dates: string[], walletData: WalletData): DailyPnl[] {
  const groupedData = groupByDate(walletData);
  const dailyPnls: DailyPnl[] = [];

  // Get current unrealized PnL from perp positions
  const currentPerpUnrealizedPnl = walletData.positions.reduce(
    (sum, pos) => sum + pos.unrealizedPnl,
    0
  );

  // Get current unrealized PnL from spot balances
  const currentSpotUnrealizedPnl = walletData.spotBalances.reduce(
    (sum, bal) => sum + bal.unrealizedPnl,
    0
  );

  const currentTotalUnrealizedPnl = currentPerpUnrealizedPnl + currentSpotUnrealizedPnl;

  // Starting equity - use combined account value minus current unrealized PnL
  const totalAccountValue = walletData.accountValue + walletData.spotAccountValue;
  let runningEquity = totalAccountValue - currentTotalUnrealizedPnl;

  for (const date of dates) {
    const dayData = groupedData.get(date) ?? { perpTrades: [], spotTrades: [], funding: [] };

    // Perp calculations
    const perpRealizedPnl = calculatePerpRealizedPnl(dayData.perpTrades);
    const perpFees = calculateDayFees(dayData.perpTrades);
    const funding = calculateDayFunding(dayData.funding);

    // Spot calculations
    const spotRealizedPnl = calculateSpotRealizedPnl(dayData.spotTrades);
    const spotFees = calculateDayFees(dayData.spotTrades);

    // Combined totals
    const totalRealizedPnl = perpRealizedPnl + spotRealizedPnl;
    const totalFees = perpFees + spotFees;

    // For unrealized PnL, we use the current value for the last day,
    // and estimate 0 for historical days (since we don't have historical position snapshots)
    const isLastDay = date === dates[dates.length - 1];
    const perpUnrealizedPnl = isLastDay ? currentPerpUnrealizedPnl : 0;
    const spotUnrealizedPnl = isLastDay ? currentSpotUnrealizedPnl : 0;
    const totalUnrealizedPnl = perpUnrealizedPnl + spotUnrealizedPnl;

    // net_pnl = realized + unrealized - fees + funding
    const netPnl = totalRealizedPnl + totalUnrealizedPnl - totalFees + funding;

    // Update running equity
    runningEquity += totalRealizedPnl - totalFees + funding;
    const equity = runningEquity + totalUnrealizedPnl;

    // Build market breakdowns
    const perpBreakdown: DailyMarketPnl = {
      realized_pnl_usd: roundToDecimals(perpRealizedPnl, 2),
      unrealized_pnl_usd: roundToDecimals(perpUnrealizedPnl, 2),
      fees_usd: roundToDecimals(perpFees, 2),
    };

    const spotBreakdown: DailyMarketPnl = {
      realized_pnl_usd: roundToDecimals(spotRealizedPnl, 2),
      unrealized_pnl_usd: roundToDecimals(spotUnrealizedPnl, 2),
      fees_usd: roundToDecimals(spotFees, 2),
    };

    dailyPnls.push({
      date,
      realized_pnl_usd: roundToDecimals(totalRealizedPnl, 2),
      unrealized_pnl_usd: roundToDecimals(totalUnrealizedPnl, 2),
      fees_usd: roundToDecimals(totalFees, 2),
      funding_usd: roundToDecimals(funding, 2),
      net_pnl_usd: roundToDecimals(netPnl, 2),
      equity_usd: roundToDecimals(equity, 2),
      perp: perpBreakdown,
      spot: spotBreakdown,
    });
  }

  return dailyPnls;
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// Pure calculation functions for testing
export function calculateNetPnl(
  realized: number,
  unrealized: number,
  fees: number,
  funding: number
): number {
  return realized + unrealized - fees + funding;
}

export function calculateEquity(
  baseEquity: number,
  realizedPnl: number,
  fees: number,
  funding: number,
  unrealizedPnl: number
): number {
  return baseEquity + realizedPnl - fees + funding + unrealizedPnl;
}
