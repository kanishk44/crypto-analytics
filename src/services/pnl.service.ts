import {
  type HyperLiquidFill,
  type HyperLiquidFunding,
  type HyperLiquidClearinghouseState,
} from "../schemas/hyperliquid";
import { type DailyPnlRow } from "../schemas/api";
import { timestampToDate } from "../utils/date";

interface SpotPosition {
  coin: string;
  size: number;
  avgCost: number;
}

export class PnlService {
  calculateDailyPnl(
    dates: string[],
    fills: HyperLiquidFill[],
    fundingPayments: HyperLiquidFunding[],
    clearinghouseState: HyperLiquidClearinghouseState | null,
    snapshotDate: string
  ): DailyPnlRow[] {
    const dailyData = new Map<
      string,
      {
        realizedPnl: number;
        fees: number;
        funding: number;
        unrealizedPnl: number;
      }
    >();

    for (const date of dates) {
      dailyData.set(date, {
        realizedPnl: 0,
        fees: 0,
        funding: 0,
        unrealizedPnl: 0,
      });
    }

    for (const fill of fills) {
      const fillDate = timestampToDate(fill.time);
      const dayData = dailyData.get(fillDate);
      if (dayData) {
        dayData.fees += Math.abs(fill.fee);
        if (fill.closedPnl !== undefined && fill.closedPnl !== 0) {
          dayData.realizedPnl += fill.closedPnl;
        }
      }
    }

    for (const funding of fundingPayments) {
      const fundingDate = timestampToDate(funding.time);
      const dayData = dailyData.get(fundingDate);
      if (dayData) {
        // userFunding returns delta.usdc as the funding payment amount
        dayData.funding += funding.delta.usdc;
      }
    }

    if (clearinghouseState && snapshotDate) {
      const snapshotDayData = dailyData.get(snapshotDate);
      if (snapshotDayData) {
        snapshotDayData.unrealizedPnl =
          clearinghouseState.assetPositions.reduce(
            (sum, pos) => sum + pos.position.unrealizedPnl,
            0
          );
      }
    }

    const rows: DailyPnlRow[] = [];
    for (const date of dates) {
      const dayData = dailyData.get(date)!;
      const netPnl =
        dayData.realizedPnl +
        dayData.unrealizedPnl -
        dayData.fees +
        dayData.funding;

      rows.push({
        date,
        realized_pnl_usd: dayData.realizedPnl,
        unrealized_pnl_usd: dayData.unrealizedPnl,
        fees_usd: dayData.fees,
        funding_usd: dayData.funding,
        net_pnl_usd: netPnl,
        equity_usd: 0,
      });
    }

    return rows;
  }

  reconstructEquity(
    rows: DailyPnlRow[],
    anchorEquity: number | null,
    anchorDate: string | null
  ): DailyPnlRow[] {
    if (rows.length === 0) return rows;

    if (anchorEquity !== null && anchorDate !== null) {
      const anchorIndex = rows.findIndex((r) => r.date === anchorDate);
      if (anchorIndex >= 0 && anchorIndex < rows.length) {
        const anchorRow = rows[anchorIndex];
        if (anchorRow) {
          anchorRow.equity_usd = anchorEquity;

          for (let i = anchorIndex - 1; i >= 0; i--) {
            const currentRow = rows[i];
            const nextRow = rows[i + 1];
            if (currentRow && nextRow) {
              currentRow.equity_usd = nextRow.equity_usd - nextRow.net_pnl_usd;
            }
          }

          for (let i = anchorIndex + 1; i < rows.length; i++) {
            const currentRow = rows[i];
            const prevRow = rows[i - 1];
            if (currentRow && prevRow) {
              currentRow.equity_usd =
                prevRow.equity_usd + currentRow.net_pnl_usd;
            }
          }
        }
      } else {
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          lastRow.equity_usd = anchorEquity;
          for (let i = rows.length - 2; i >= 0; i--) {
            const currentRow = rows[i];
            const nextRow = rows[i + 1];
            if (currentRow && nextRow) {
              currentRow.equity_usd = nextRow.equity_usd - nextRow.net_pnl_usd;
            }
          }
        }
      }
    } else {
      let equity = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        const currentRow = rows[i];
        if (currentRow) {
          equity = equity - currentRow.net_pnl_usd;
          currentRow.equity_usd = equity;
        }
      }
    }

    return rows;
  }

  calculateSpotPnL(fills: HyperLiquidFill[]): Map<string, number> {
    const positions = new Map<string, SpotPosition>();
    const dailySpotPnL = new Map<string, number>();

    // Filter to only spot fills (coin starts with "@")
    const spotFills = fills.filter((fill) => fill.coin.startsWith("@"));

    for (const fill of spotFills) {
      const fillDate = timestampToDate(fill.time);
      const coin = fill.coin;

      if (!positions.has(coin)) {
        positions.set(coin, { coin, size: 0, avgCost: 0 });
      }

      const position = positions.get(coin)!;
      // Use isBuy if available, otherwise infer from side ('B' = Bid = Buy, 'A' = Ask = Sell)
      const isBuy = fill.isBuy ?? fill.side === 'B';
      const size = fill.sz;
      const price = fill.px;

      if (isBuy) {
        const totalCost = position.size * position.avgCost + size * price;
        position.size += size;
        position.avgCost =
          position.size > 0 ? totalCost / position.size : price;
      } else {
        if (position.size > 0) {
          const soldSize = Math.min(size, position.size);
          const realizedPnL = (price - position.avgCost) * soldSize;
          const currentPnL = dailySpotPnL.get(fillDate) ?? 0;
          dailySpotPnL.set(fillDate, currentPnL + realizedPnL);
          position.size -= soldSize;
        }
      }
    }

    return dailySpotPnL;
  }

  mergeSpotPnLIntoRealized(
    rows: DailyPnlRow[],
    spotPnL: Map<string, number>
  ): DailyPnlRow[] {
    for (const row of rows) {
      const spotPnLForDay = spotPnL.get(row.date) ?? 0;
      row.realized_pnl_usd += spotPnLForDay;
      row.net_pnl_usd =
        row.realized_pnl_usd +
        row.unrealized_pnl_usd -
        row.fees_usd +
        row.funding_usd;
    }
    return rows;
  }

  /**
   * Apply stored equity snapshots where available, then reconstruct missing dates
   * Priority: 1) Stored snapshots, 2) Live anchor (today), 3) Reconstruction from nearest known
   */
  applyStoredEquityAndReconstruct(
    rows: DailyPnlRow[],
    storedEquityMap: Map<string, number>,
    liveAnchorEquity: number | null,
    liveAnchorDate: string | null
  ): DailyPnlRow[] {
    if (rows.length === 0) return rows;

    // First, apply all stored equity values
    for (const row of rows) {
      if (storedEquityMap.has(row.date)) {
        row.equity_usd = storedEquityMap.get(row.date)!;
      }
    }

    // Apply live anchor if available and date is in range
    if (liveAnchorEquity !== null && liveAnchorDate !== null) {
      const liveRow = rows.find((r) => r.date === liveAnchorDate);
      if (liveRow && !storedEquityMap.has(liveAnchorDate)) {
        liveRow.equity_usd = liveAnchorEquity;
      }
    }

    // Find all dates that have known equity (stored or live anchor)
    const knownDates = new Set<string>();
    for (const row of rows) {
      if (row.equity_usd !== 0 || storedEquityMap.has(row.date)) {
        knownDates.add(row.date);
      }
    }
    if (
      liveAnchorDate &&
      liveAnchorEquity !== null &&
      rows.some((r) => r.date === liveAnchorDate)
    ) {
      knownDates.add(liveAnchorDate);
    }

    // If no known equity at all, fall back to basic reconstruction
    if (knownDates.size === 0) {
      return this.reconstructEquity(rows, liveAnchorEquity, liveAnchorDate);
    }

    // Reconstruct backwards and forwards from known points
    // Process from the end to fill gaps
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (!row) continue;

      if (!knownDates.has(row.date) && row.equity_usd === 0) {
        // Look for the next known date to reconstruct backwards from
        const nextRow = rows[i + 1];
        if (nextRow && nextRow.equity_usd !== 0) {
          row.equity_usd = nextRow.equity_usd - nextRow.net_pnl_usd;
        }
      }
    }

    // Process from the start to fill any remaining gaps (forward reconstruction)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      if (row.equity_usd === 0 && !knownDates.has(row.date)) {
        // Look for the previous known date to reconstruct forwards from
        const prevRow = rows[i - 1];
        if (prevRow && prevRow.equity_usd !== 0) {
          row.equity_usd = prevRow.equity_usd + row.net_pnl_usd;
        }
      }
    }

    return rows;
  }
}
