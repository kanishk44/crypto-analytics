import { z } from 'zod';

export const CoinGeckoTokenDetailsSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  market_data: z.object({
    current_price: z.record(z.string(), z.number().nullable()),
    market_cap: z.record(z.string(), z.number().nullable()),
    total_volume: z.record(z.string(), z.number().nullable()),
    price_change_percentage_24h: z.number().nullable(),
  }),
});

export type CoinGeckoTokenDetails = z.infer<typeof CoinGeckoTokenDetailsSchema>;

export const CoinGeckoMarketChartSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])),
  market_caps: z.array(z.tuple([z.number(), z.number()])),
  total_volumes: z.array(z.tuple([z.number(), z.number()])),
});

export type CoinGeckoMarketChart = z.infer<typeof CoinGeckoMarketChartSchema>;

