import { env } from '../config/env';
import { fetchWithRetry } from '../utils/http';
import {
  CoinGeckoTokenDetailsSchema,
  CoinGeckoMarketChartSchema,
  type CoinGeckoTokenDetails,
  type CoinGeckoMarketChart,
} from '../schemas/coingecko';

export class CoinGeckoService {
  private readonly baseUrl: string;

  constructor(baseUrl = env.COINGECKO_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async fetchTokenDetails(id: string): Promise<CoinGeckoTokenDetails> {
    const url = `${this.baseUrl}/coins/${encodeURIComponent(id)}`;
    return fetchWithRetry(url, CoinGeckoTokenDetailsSchema, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  async fetchTokenMarketChart(
    id: string,
    vsCurrency: string,
    days: number
  ): Promise<CoinGeckoMarketChart> {
    const url = `${this.baseUrl}/coins/${encodeURIComponent(id)}/market_chart`;
    const params = new URLSearchParams({
      vs_currency: vsCurrency,
      days: days.toString(),
    });
    const fullUrl = `${url}?${params.toString()}`;

    return fetchWithRetry(fullUrl, CoinGeckoMarketChartSchema, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
  }
}

