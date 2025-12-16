import { env } from '../config/env';
import { fetchWithRetry } from '../utils/http';
import {
  HyperLiquidUserFillsResponseSchema,
  HyperLiquidFundingResponseSchema,
  HyperLiquidClearinghouseStateSchema,
  type HyperLiquidFill,
  type HyperLiquidFunding,
  type HyperLiquidClearinghouseState,
} from '../schemas/hyperliquid';
import { dateToTimestamp, timestampToDate } from '../utils/date';

export class HyperLiquidService {
  private readonly baseUrl: string;

  constructor(baseUrl = env.HYPERLIQUID_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async fetchUserFills(
    wallet: string,
    startDate: string,
    endDate: string
  ): Promise<HyperLiquidFill[]> {
    const startTs = dateToTimestamp(startDate);
    const endTs = dateToTimestamp(endDate) + 86400000 - 1;

    const response = await fetchWithRetry(
      `${this.baseUrl}/userFills`,
      HyperLiquidUserFillsResponseSchema,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: wallet,
        }),
      }
    );

    return response.filter((fill) => {
      const fillDate = timestampToDate(fill.time);
      return fillDate >= startDate && fillDate <= endDate;
    });
  }

  async fetchFundingPayments(
    wallet: string,
    startDate: string,
    endDate: string
  ): Promise<HyperLiquidFunding[]> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/fundingHistory`,
      HyperLiquidFundingResponseSchema,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: wallet,
        }),
      }
    );

    return response.filter((funding) => {
      const fundingDate = timestampToDate(funding.time);
      return fundingDate >= startDate && fundingDate <= endDate;
    });
  }

  async fetchClearinghouseState(wallet: string): Promise<HyperLiquidClearinghouseState | null> {
    try {
      const response = await fetchWithRetry(
        `${this.baseUrl}/clearinghouseState`,
        HyperLiquidClearinghouseStateSchema,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user: wallet,
          }),
        }
      );
      return response;
    } catch (error) {
      console.warn(`Failed to fetch clearinghouse state for wallet ${wallet}:`, error);
      return null;
    }
  }

  getCurrentEquity(state: HyperLiquidClearinghouseState | null): number {
    if (!state) return 0;
    return state.marginSummary.accountValue;
  }

  getCurrentUnrealizedPnl(state: HyperLiquidClearinghouseState | null): number {
    if (!state) return 0;
    return state.assetPositions.reduce((sum, pos) => sum + pos.position.unrealizedPnl, 0);
  }
}

