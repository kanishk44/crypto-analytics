import {
  type HyperLiquidFill,
  type HyperLiquidFunding,
  type HyperLiquidClearinghouseState,
} from '../schemas/hyperliquid';
import { type DailyPnlRow } from '../schemas/api';
import { timestampToDate, getToday } from '../utils/date';

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
    const dailyData = new Map<string, {
      realizedPnl: number;
      fees: number;
      funding: number;
      unrealizedPnl: number;
    }>();

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
        dayData.funding += funding.premium;
      }
    }

    if (clearinghouseState && snapshotDate) {
      const snapshotDayData = dailyData.get(snapshotDate);
      if (snapshotDayData) {
        snapshotDayData.unrealizedPnl = clearinghouseState.assetPositions.reduce(
          (sum, pos) => sum + pos.position.unrealizedPnl,
          0
        );
      }
    }

    const rows: DailyPnlRow[] = [];
    for (const date of dates) {
      const dayData = dailyData.get(date)!;
      const netPnl = dayData.realizedPnl + dayData.unrealizedPnl - dayData.fees + dayData.funding;

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
      if (anchorIndex >= 0) {
        rows[anchorIndex].equity_usd = anchorEquity;

        for (let i = anchorIndex - 1; i >= 0; i--) {
          rows[i].equity_usd = rows[i + 1].equity_usd - rows[i + 1].net_pnl_usd;
        }

        for (let i = anchorIndex + 1; i < rows.length; i++) {
          rows[i].equity_usd = rows[i - 1].equity_usd + rows[i].net_pnl_usd;
        }
      } else {
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          lastRow.equity_usd = anchorEquity;
          for (let i = rows.length - 2; i >= 0; i--) {
            rows[i].equity_usd = rows[i + 1].equity_usd - rows[i + 1].net_pnl_usd;
          }
        }
      }
    } else {
      let equity = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        equity = equity - rows[i].net_pnl_usd;
        rows[i].equity_usd = equity;
      }
    }

    return rows;
  }

  calculateSpotPnL(fills: HyperLiquidFill[]): Map<string, number> {
    const positions = new Map<string, SpotPosition>();
    const dailySpotPnL = new Map<string, number>();

    for (const fill of fills) {
      const fillDate = timestampToDate(fill.time);
      const coin = fill.coin;

      if (!positions.has(coin)) {
        positions.set(coin, { coin, size: 0, avgCost: 0 });
      }

      const position = positions.get(coin)!;
      const isBuy = fill.isBuy;
      const size = fill.sz;
      const price = fill.px;

      if (isBuy) {
        const totalCost = position.size * position.avgCost + size * price;
        position.size += size;
        position.avgCost = position.size > 0 ? totalCost / position.size : price;
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

  mergeSpotPnLIntoRealized(rows: DailyPnlRow[], spotPnL: Map<string, number>): DailyPnlRow[] {
    for (const row of rows) {
      const spotPnLForDay = spotPnL.get(row.date) ?? 0;
      row.realized_pnl_usd += spotPnLForDay;
      row.net_pnl_usd = row.realized_pnl_usd + row.unrealized_pnl_usd - row.fees_usd + row.funding_usd;
    }
    return rows;
  }
}

