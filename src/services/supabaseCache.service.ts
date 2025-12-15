import { supabase } from "../lib/supabase.ts";
import type { TokenInsightResponse } from "../types/token.ts";
import type { WalletPnlResponse } from "../types/pnl.ts";
import type { TokenInsightRow, WalletDailyPnlRow, TokenInsightInsert, WalletDailyPnlInsert } from "../types/database.ts";
import { env } from "../config/env.ts";
import { logger } from "../utils/logger.ts";

function isCacheValid(createdAt: string, ttlMinutes: number): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
  return diffMinutes < ttlMinutes;
}

// Token Insight Cache

export async function getCachedTokenInsight(
  tokenId: string,
  vsCurrency: string,
  historyDays: number
): Promise<TokenInsightResponse | null> {
  try {
    const { data, error } = await supabase
      .from("token_insights")
      .select("*")
      .eq("token_id", tokenId)
      .eq("vs_currency", vsCurrency)
      .eq("history_days", historyDays)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as TokenInsightRow;

    if (!isCacheValid(row.created_at, env.TOKEN_INSIGHT_CACHE_TTL)) {
      logger.debug("Token insight cache expired", { tokenId, createdAt: row.created_at });
      return null;
    }

    return {
      source: "coingecko",
      token: row.token_json,
      insight: row.insight_json,
      model: {
        provider: row.provider,
        model: row.model,
      },
    };
  } catch (error) {
    logger.warn("Failed to read token insight cache", { tokenId, error });
    return null;
  }
}

export async function cacheTokenInsight(
  tokenId: string,
  vsCurrency: string,
  historyDays: number,
  response: TokenInsightResponse
): Promise<void> {
  try {
    const insertData: TokenInsightInsert = {
      token_id: tokenId,
      vs_currency: vsCurrency,
      history_days: historyDays,
      token_json: response.token,
      insight_json: response.insight,
      provider: response.model.provider,
      model: response.model.model,
    };

    const { error } = await supabase
      .from("token_insights")
      .insert(insertData as never);

    if (error) {
      logger.warn("Failed to cache token insight", { tokenId, error: error.message });
    } else {
      logger.debug("Token insight cached", { tokenId });
    }
  } catch (error) {
    logger.warn("Failed to cache token insight", { tokenId, error });
  }
}

// Wallet PnL Cache

export async function getCachedWalletPnl(
  wallet: string,
  start: string,
  end: string
): Promise<WalletPnlResponse | null> {
  try {
    const { data, error } = await supabase
      .from("wallet_daily_pnls")
      .select("*")
      .eq("wallet", wallet.toLowerCase())
      .eq("start_date", start)
      .eq("end_date", end)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as WalletDailyPnlRow;

    if (!isCacheValid(row.created_at, env.PNL_CACHE_TTL)) {
      logger.debug("Wallet PnL cache expired", { wallet, createdAt: row.created_at });
      return null;
    }

    return {
      wallet: row.wallet,
      start: row.start_date,
      end: row.end_date,
      daily: row.daily,
      summary: row.summary,
      diagnostics: row.diagnostics,
    };
  } catch (error) {
    logger.warn("Failed to read wallet PnL cache", { wallet, error });
    return null;
  }
}

export async function cacheWalletPnl(
  wallet: string,
  start: string,
  end: string,
  response: WalletPnlResponse
): Promise<void> {
  try {
    const insertData: WalletDailyPnlInsert = {
      wallet: wallet.toLowerCase(),
      start_date: start,
      end_date: end,
      daily: response.daily,
      summary: response.summary,
      diagnostics: response.diagnostics,
    };

    const { error } = await supabase
      .from("wallet_daily_pnls")
      .insert(insertData as never);

    if (error) {
      logger.warn("Failed to cache wallet PnL", { wallet, error: error.message });
    } else {
      logger.debug("Wallet PnL cached", { wallet });
    }
  } catch (error) {
    logger.warn("Failed to cache wallet PnL", { wallet, error });
  }
}
