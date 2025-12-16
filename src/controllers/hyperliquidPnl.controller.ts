import { Request, Response, NextFunction } from 'express';
import { HyperLiquidService } from '../services/hyperliquid.service';
import { PnlService } from '../services/pnl.service';
import { HyperLiquidPnlQuery, HyperLiquidPnlResponse } from '../schemas/api';
import { HttpError } from '../utils/http';
import { getDateRange, getToday } from '../utils/date';

export class HyperLiquidPnlController {
  private hyperliquidService: HyperLiquidService;
  private pnlService: PnlService;

  constructor() {
    this.hyperliquidService = new HyperLiquidService();
    this.pnlService = new PnlService();
  }

  async getWalletPnl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const wallet = req.params.wallet as string;
      const query = req.query as unknown as HyperLiquidPnlQuery;

      if (!wallet || wallet.trim().length === 0) {
        throw new HttpError(400, 'Wallet address is required');
      }

      if (!query.start || !query.end) {
        throw new HttpError(400, 'Start and end dates are required (format: YYYY-MM-DD)');
      }

      const dates = getDateRange(query.start, query.end);

      if (dates.length > 365) {
        throw new HttpError(400, 'Date range cannot exceed 365 days');
      }

      const [fills, fundingPayments, clearinghouseState] = await Promise.all([
        this.hyperliquidService.fetchUserFills(wallet, query.start, query.end),
        this.hyperliquidService.fetchFundingPayments(wallet, query.start, query.end),
        this.hyperliquidService.fetchClearinghouseState(wallet),
      ]);

      const today = getToday();
      const snapshotDate = clearinghouseState ? today : null;
      const anchorEquity = clearinghouseState
        ? this.hyperliquidService.getCurrentEquity(clearinghouseState)
        : null;
      const anchorUnrealizedPnl = clearinghouseState
        ? this.hyperliquidService.getCurrentUnrealizedPnl(clearinghouseState)
        : null;

      let dailyRows = this.pnlService.calculateDailyPnl(
        dates,
        fills,
        fundingPayments,
        clearinghouseState,
        snapshotDate ?? dates[dates.length - 1] ?? today
      );

      if (snapshotDate && dates.includes(snapshotDate) && anchorUnrealizedPnl !== null) {
        const snapshotRow = dailyRows.find((r) => r.date === snapshotDate);
        if (snapshotRow) {
          snapshotRow.unrealized_pnl_usd = anchorUnrealizedPnl;
          snapshotRow.net_pnl_usd =
            snapshotRow.realized_pnl_usd +
            snapshotRow.unrealized_pnl_usd -
            snapshotRow.fees_usd +
            snapshotRow.funding_usd;
        }
      }

      const hasSpotFills = fills.some((fill) => {
        return fill.coin && !fill.coin.includes('-PERP') && !fill.coin.includes('PERP');
      });

      if (hasSpotFills) {
        const spotPnL = this.pnlService.calculateSpotPnL(fills);
        dailyRows = this.pnlService.mergeSpotPnLIntoRealized(dailyRows, spotPnL);
      }

      dailyRows = this.pnlService.reconstructEquity(dailyRows, anchorEquity, snapshotDate);

      const summary = {
        total_realized_usd: dailyRows.reduce((sum, row) => sum + row.realized_pnl_usd, 0),
        total_unrealized_usd: dailyRows.reduce((sum, row) => sum + row.unrealized_pnl_usd, 0),
        total_fees_usd: dailyRows.reduce((sum, row) => sum + row.fees_usd, 0),
        total_funding_usd: dailyRows.reduce((sum, row) => sum + row.funding_usd, 0),
        net_pnl_usd: dailyRows.reduce((sum, row) => sum + row.net_pnl_usd, 0),
      };

      const unrealizedPolicy = snapshotDate
        ? `Unrealized PnL is only available for the current/last day (${snapshotDate}) from clearinghouseState. Historical days show 0 unrealized PnL. Equity is reconstructed backwards from the current equity snapshot.`
        : 'No clearinghouse state available. Equity is reconstructed as relative values (not anchored to live snapshot). Unrealized PnL is 0 for all days.';

      const response: HyperLiquidPnlResponse = {
        wallet,
        start: query.start,
        end: query.end,
        daily: dailyRows,
        summary,
        diagnostics: {
          data_source: 'hyperliquid_api',
          last_api_call: new Date().toISOString(),
          notes: 'PnL calculated using event-based data from HyperLiquid APIs. Equity is reconstructed, not historical snapshots.',
          unrealized_policy: unrealizedPolicy,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

