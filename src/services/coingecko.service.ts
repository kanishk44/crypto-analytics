import type {
  TokenInfo,
  TokenMarketData,
  CoinGeckoTokenResponse,
} from "../types/token.ts";
import { NotFoundError, ExternalApiError } from "../types/errors.ts";
import { logger } from "../utils/logger.ts";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

export async function getTokenFromCoinGecko(
  tokenId: string,
  vsCurrency: string
): Promise<TokenInfo> {
  const url = `${COINGECKO_BASE_URL}/coins/${encodeURIComponent(tokenId)}?localization=false&tickers=false&community_data=false&developer_data=false`;

  logger.info("Fetching token from CoinGecko", { tokenId, url });

  const startTime = Date.now();
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    logger.error("CoinGecko request failed", { tokenId, error });
    throw new ExternalApiError("Failed to connect to CoinGecko API");
  }

  const duration = Date.now() - startTime;
  logger.info("CoinGecko response received", { tokenId, status: response.status, duration });

  if (response.status === 404) {
    throw new NotFoundError("TOKEN_NOT_FOUND", `Token '${tokenId}' not found on CoinGecko`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new ExternalApiError(`CoinGecko API error: ${response.status}`, { errorText });
  }

  let data: CoinGeckoTokenResponse;
  try {
    data = await response.json() as CoinGeckoTokenResponse;
  } catch {
    throw new ExternalApiError("Failed to parse CoinGecko response");
  }

  // Map to internal format
  const marketData: TokenMarketData = {
    current_price_usd: data.market_data.current_price[vsCurrency] ?? data.market_data.current_price["usd"] ?? 0,
    market_cap_usd: data.market_data.market_cap[vsCurrency] ?? data.market_data.market_cap["usd"] ?? 0,
    total_volume_usd: data.market_data.total_volume[vsCurrency] ?? data.market_data.total_volume["usd"] ?? 0,
    price_change_percentage_24h: data.market_data.price_change_percentage_24h ?? 0,
    price_change_percentage_7d: data.market_data.price_change_percentage_7d,
    price_change_percentage_30d: data.market_data.price_change_percentage_30d,
  };

  return {
    id: data.id,
    symbol: data.symbol,
    name: data.name,
    market_data: marketData,
  };
}

export async function getMarketChart(
  tokenId: string,
  vsCurrency: string,
  days: number
): Promise<{ prices: [number, number][] }> {
  const url = `${COINGECKO_BASE_URL}/coins/${encodeURIComponent(tokenId)}/market_chart?vs_currency=${vsCurrency}&days=${days}`;

  logger.info("Fetching market chart from CoinGecko", { tokenId, days });

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new ExternalApiError(`CoinGecko market chart error: ${response.status}`);
    }

    const data = await response.json() as { prices: [number, number][] };
    return data;
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    logger.error("Failed to fetch market chart", { tokenId, error });
    throw new ExternalApiError("Failed to fetch market chart from CoinGecko");
  }
}

