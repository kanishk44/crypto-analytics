import type { DailyPnl } from "../types/pnl.ts";
import type { WalletData } from "./hyperliquid.service.ts";
import type { NormalizedTrade, NormalizedFunding } from "../types/hyperliquid.ts";
import { formatDate } from "../utils/dateRange.ts";

interface DayData {
  trades: NormalizedTrade[];
  funding: NormalizedFunding[];
}

function groupByDate(walletData: WalletData): Map<string, DayData> {
  const grouped = new Map<string, DayData>();

  // Group trades by date
  for (const trade of walletData.trades) {
    const date = formatDate(trade.timestamp);
    const existing = grouped.get(date) ?? { trades: [], funding: [] };
    existing.trades.push(trade);
    grouped.set(date, existing);
  }

  // Group funding by date
  for (const fund of walletData.fundingPayments) {
    const date = formatDate(fund.timestamp);
    const existing = grouped.get(date) ?? { trades: [], funding: [] };
    existing.funding.push(fund);
    grouped.set(date, existing);
  }

  return grouped;
}

function calculateDayRealizedPnl(trades: NormalizedTrade[]): number {
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

  // Get current unrealized PnL from positions
  const currentUnrealizedPnl = walletData.positions.reduce(
    (sum, pos) => sum + pos.unrealizedPnl,
    0
  );

  // Starting equity - use account value minus current unrealized PnL
  // This gives us the "base" equity before any unrealized gains/losses
  let runningEquity = walletData.accountValue - currentUnrealizedPnl;

  for (const date of dates) {
    const dayData = groupedData.get(date) ?? { trades: [], funding: [] };

    const realizedPnl = calculateDayRealizedPnl(dayData.trades);
    const fees = calculateDayFees(dayData.trades);
    const funding = calculateDayFunding(dayData.funding);

    // For unrealized PnL, we use the current value for the last day,
    // and estimate 0 for historical days (since we don't have historical position snapshots)
    const isLastDay = date === dates[dates.length - 1];
    const unrealizedPnl = isLastDay ? currentUnrealizedPnl : 0;

    // net_pnl = realized + unrealized - fees + funding
    const netPnl = realizedPnl + unrealizedPnl - fees + funding;

    // Update running equity
    runningEquity += realizedPnl - fees + funding;
    const equity = runningEquity + unrealizedPnl;

    dailyPnls.push({
      date,
      realized_pnl_usd: roundToDecimals(realizedPnl, 2),
      unrealized_pnl_usd: roundToDecimals(unrealizedPnl, 2),
      fees_usd: roundToDecimals(fees, 2),
      funding_usd: roundToDecimals(funding, 2),
      net_pnl_usd: roundToDecimals(netPnl, 2),
      equity_usd: roundToDecimals(equity, 2),
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

