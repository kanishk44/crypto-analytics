import type { WalletPnlResponse, DailyPnl, PnlSummary, PnlDiagnostics } from "../types/pnl.ts";
import { fetchWalletData } from "./hyperliquid.service.ts";
import { calculateDailyPnl } from "./pnlCalculation.service.ts";
import { getCachedWalletPnl, cacheWalletPnl } from "./supabaseCache.service.ts";
import { getDateRange } from "../utils/dateRange.ts";
import { logger } from "../utils/logger.ts";

export async function getWalletPnl(
  wallet: string,
  start: string,
  end: string
): Promise<WalletPnlResponse> {
  // Check cache first
  const cached = await getCachedWalletPnl(wallet, start, end);
  if (cached) {
    logger.info("Cache hit for wallet PnL", { wallet, start, end });
    return cached;
  }

  logger.info("Cache miss, calculating PnL", { wallet, start, end });

  // Fetch data from HyperLiquid
  const dates = getDateRange(start, end);
  const walletData = await fetchWalletData(wallet, start, end);
  const lastApiCall = new Date().toISOString();

  // Calculate daily PnL
  const dailyPnls: DailyPnl[] = calculateDailyPnl(dates, walletData);

  // Calculate summary
  const summary: PnlSummary = {
    total_realized_usd: dailyPnls.reduce((sum, d) => sum + d.realized_pnl_usd, 0),
    total_unrealized_usd: dailyPnls.length > 0 ? dailyPnls[dailyPnls.length - 1]!.unrealized_pnl_usd : 0,
    total_fees_usd: dailyPnls.reduce((sum, d) => sum + d.fees_usd, 0),
    total_funding_usd: dailyPnls.reduce((sum, d) => sum + d.funding_usd, 0),
    net_pnl_usd: dailyPnls.reduce((sum, d) => sum + d.net_pnl_usd, 0),
  };

  const diagnostics: PnlDiagnostics = {
    data_source: "hyperliquid_api",
    last_api_call: lastApiCall,
    notes: "PnL calculated using daily close prices",
  };

  const response: WalletPnlResponse = {
    wallet,
    start,
    end,
    daily: dailyPnls,
    summary,
    diagnostics,
  };

  // Cache the result
  await cacheWalletPnl(wallet, start, end, response);

  return response;
}

