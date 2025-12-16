import { z } from 'zod';

export const TokenInsightRequestSchema = z.object({
  vs_currency: z.string().default('usd'),
  history_days: z.number().int().min(1).max(365).default(30),
}).partial();

export type TokenInsightRequest = z.infer<typeof TokenInsightRequestSchema>;

export const TokenInsightResponseSchema = z.object({
  source: z.literal('coingecko'),
  token: z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    market_data: z.object({
      current_price_usd: z.number().nullable(),
      market_cap_usd: z.number().nullable(),
      total_volume_usd: z.number().nullable(),
      price_change_percentage_24h: z.number().nullable(),
    }),
  }),
  insight: z.object({
    reasoning: z.string(),
    sentiment: z.enum(['Bullish', 'Bearish', 'Neutral']),
    risk_level: z.enum(['Low', 'Medium', 'High']).optional(),
    time_horizon: z.enum(['Short', 'Medium', 'Long']).optional(),
  }),
  model: z.object({
    provider: z.string(),
    model: z.string(),
  }),
});

export type TokenInsightResponse = z.infer<typeof TokenInsightResponseSchema>;

export const HyperLiquidPnlQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export type HyperLiquidPnlQuery = z.infer<typeof HyperLiquidPnlQuerySchema>;

export const DailyPnlRowSchema = z.object({
  date: z.string(),
  realized_pnl_usd: z.number(),
  unrealized_pnl_usd: z.number(),
  fees_usd: z.number(),
  funding_usd: z.number(),
  net_pnl_usd: z.number(),
  equity_usd: z.number(),
});

export type DailyPnlRow = z.infer<typeof DailyPnlRowSchema>;

export const HyperLiquidPnlResponseSchema = z.object({
  wallet: z.string(),
  start: z.string(),
  end: z.string(),
  daily: z.array(DailyPnlRowSchema),
  summary: z.object({
    total_realized_usd: z.number(),
    total_unrealized_usd: z.number(),
    total_fees_usd: z.number(),
    total_funding_usd: z.number(),
    net_pnl_usd: z.number(),
  }),
  diagnostics: z.object({
    data_source: z.literal('hyperliquid_api'),
    last_api_call: z.string(),
    notes: z.string(),
    unrealized_policy: z.string().optional(),
  }),
});

export type HyperLiquidPnlResponse = z.infer<typeof HyperLiquidPnlResponseSchema>;

