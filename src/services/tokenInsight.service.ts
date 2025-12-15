import type { TokenInsightResponse } from "../types/token.ts";
import { getTokenFromCoinGecko } from "./coingecko.service.ts";
import { generateInsight } from "./aiInsight.service.ts";
import { getCachedTokenInsight, cacheTokenInsight } from "./supabaseCache.service.ts";
import { logger } from "../utils/logger.ts";
import { env } from "../config/env.ts";

export async function getTokenInsight(
  tokenId: string,
  vsCurrency: string,
  historyDays: number
): Promise<TokenInsightResponse> {
  // Check cache first
  const cached = await getCachedTokenInsight(tokenId, vsCurrency, historyDays);
  if (cached) {
    logger.info("Cache hit for token insight", { tokenId, vsCurrency });
    return cached;
  }

  logger.info("Cache miss, fetching fresh data", { tokenId, vsCurrency, historyDays });

  // Fetch token data from CoinGecko
  const tokenInfo = await getTokenFromCoinGecko(tokenId, vsCurrency);

  // Generate AI insight
  const insight = await generateInsight(tokenInfo);

  // Build response
  const response: TokenInsightResponse = {
    source: "coingecko",
    token: tokenInfo,
    insight,
    model: {
      provider: "openrouter",
      model: env.OPENROUTER_MODEL,
    },
  };

  // Cache the result
  await cacheTokenInsight(tokenId, vsCurrency, historyDays, response);

  return response;
}

