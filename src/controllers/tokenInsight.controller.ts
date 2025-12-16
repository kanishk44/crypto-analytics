import { Request, Response, NextFunction } from 'express';
import { CoinGeckoService } from '../services/coingecko.service';
import { AIService } from '../services/ai.service';
import { TokenInsightRequest, TokenInsightResponse } from '../schemas/api';
import { HttpError } from '../utils/http';

export class TokenInsightController {
  private coingeckoService: CoinGeckoService;
  private aiService: AIService;

  constructor() {
    this.coingeckoService = new CoinGeckoService();
    this.aiService = new AIService();
  }

  async getTokenInsight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokenId = req.params.id as string;
      const body = (req.body ?? {}) as Partial<TokenInsightRequest>;
      const vsCurrency = body.vs_currency ?? 'usd';
      const historyDays = body.history_days ?? 30;

      if (!tokenId || tokenId.trim().length === 0) {
        throw new HttpError(400, 'Token ID is required');
      }

      const tokenData = await this.coingeckoService.fetchTokenDetails(tokenId);

      let marketChartData: { prices: Array<[number, number]> } | undefined;
      try {
        const chartData = await this.coingeckoService.fetchTokenMarketChart(
          tokenId,
          vsCurrency,
          historyDays
        );
        marketChartData = { prices: chartData.prices };
      } catch (error) {
        console.warn(`Failed to fetch market chart for ${tokenId}:`, error);
      }

      const insight = await this.aiService.generateTokenInsight(tokenData, marketChartData);

      const modelParts = process.env.OPENROUTER_MODEL?.split('/') ?? ['openrouter', 'unknown'];
      const provider = modelParts[0] ?? 'openrouter';
      const model = modelParts.slice(1).join('/') || 'unknown';

      const response: TokenInsightResponse = {
        source: 'coingecko',
        token: {
          id: tokenData.id,
          symbol: tokenData.symbol,
          name: tokenData.name,
          market_data: {
            current_price_usd: tokenData.market_data.current_price.usd ?? null,
            market_cap_usd: tokenData.market_data.market_cap.usd ?? null,
            total_volume_usd: tokenData.market_data.total_volume.usd ?? null,
            price_change_percentage_24h: tokenData.market_data.price_change_percentage_24h,
          },
        },
        insight: {
          reasoning: insight.reasoning,
          sentiment: insight.sentiment,
          ...(insight.risk_level && { risk_level: insight.risk_level }),
          ...(insight.time_horizon && { time_horizon: insight.time_horizon }),
        },
        model: {
          provider,
          model,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

