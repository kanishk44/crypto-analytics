import { z } from "zod";

// Request schemas
export const tokenInsightParamsSchema = z.object({
  id: z.string().min(1, "Token ID is required"),
});

export const tokenInsightBodySchema = z.object({
  vs_currency: z.string().default("usd"),
  history_days: z.number().int().min(1).max(365).default(30),
}).optional();

export type TokenInsightParams = z.infer<typeof tokenInsightParamsSchema>;
export type TokenInsightBody = z.infer<typeof tokenInsightBodySchema>;

// CoinGecko response types
export interface CoinGeckoMarketData {
  current_price: Record<string, number>;
  market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  price_change_percentage_24h: number;
  price_change_percentage_7d?: number;
  price_change_percentage_30d?: number;
}

export interface CoinGeckoTokenResponse {
  id: string;
  symbol: string;
  name: string;
  market_data: CoinGeckoMarketData;
  description?: { en?: string };
  categories?: string[];
}

export interface CoinGeckoMarketChartResponse {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

// Internal types
export interface TokenMarketData {
  current_price_usd: number;
  market_cap_usd: number;
  total_volume_usd: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d?: number | undefined;
  price_change_percentage_30d?: number | undefined;
}

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  market_data: TokenMarketData;
}

// AI Insight types
export const insightSchema = z.object({
  reasoning: z.string(),
  sentiment: z.enum(["Bullish", "Bearish", "Neutral"]),
});

export type TokenInsight = z.infer<typeof insightSchema>;

export interface ModelInfo {
  provider: string;
  model: string;
}

// API Response
export interface TokenInsightResponse {
  source: "coingecko";
  token: TokenInfo;
  insight: TokenInsight;
  model: ModelInfo;
}

