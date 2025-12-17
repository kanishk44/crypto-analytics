import { z } from "zod";
import { env } from "../config/env";
import { fetchWithRetry, HttpError } from "../utils/http";
import {
  HyperLiquidUserFillsResponseSchema,
  HyperLiquidFundingResponseSchema,
  HyperLiquidClearinghouseStateSchema,
  type HyperLiquidFill,
  type HyperLiquidFunding,
  type HyperLiquidClearinghouseState,
} from "../schemas/hyperliquid";
import { timestampToDate, parseDate } from "../utils/date";

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
    try {
      const normalizedWallet = wallet.toLowerCase();
      console.log(
        `Fetching userFills for wallet ${normalizedWallet} from ${this.baseUrl}`
      );
      // Try direct object format first (most common for HyperLiquid)
      const requestBody = {
        type: "userFills",
        user: normalizedWallet,
      };
      console.log("Request body:", JSON.stringify(requestBody));
      console.log(`POST URL: ${this.baseUrl}`);

      // HyperLiquid may return responses wrapped in an array when using array requests
      // We'll use a more flexible schema that can handle both wrapped and unwrapped responses
      const rawResponse = await fetchWithRetry(this.baseUrl, z.unknown(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Handle both array-wrapped and direct array responses
      let response: HyperLiquidFill[];
      if (Array.isArray(rawResponse)) {
        // Check if it's wrapped: [{ data: [...] }] or direct: [...]
        if (rawResponse.length > 0 && Array.isArray(rawResponse[0])) {
          response = rawResponse[0] as HyperLiquidFill[];
        } else if (
          rawResponse.length > 0 &&
          typeof rawResponse[0] === "object" &&
          "data" in rawResponse[0]
        ) {
          response = (rawResponse[0] as { data: unknown })
            .data as HyperLiquidFill[];
        } else {
          // Direct array response
          response = HyperLiquidUserFillsResponseSchema.parse(rawResponse);
        }
      } else if (
        typeof rawResponse === "object" &&
        rawResponse !== null &&
        "data" in rawResponse
      ) {
        response = (rawResponse as { data: unknown }).data as HyperLiquidFill[];
        response = HyperLiquidUserFillsResponseSchema.parse(response);
      } else {
        response = HyperLiquidUserFillsResponseSchema.parse(rawResponse);
      }

      console.log(`Received ${response.length} fills before filtering`);
      const filtered = response.filter((fill) => {
        const fillDate = timestampToDate(fill.time);
        return fillDate >= startDate && fillDate <= endDate;
      });
      console.log(
        `Filtered to ${filtered.length} fills for date range ${startDate} to ${endDate}`
      );
      return filtered;
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(
          `Error fetching userFills for wallet ${wallet}: ${error.statusCode} - ${error.message}`,
          error.details
        );
        if (error.statusCode === 404) {
          console.warn(
            `No fills found for wallet ${wallet} (404). Returning empty array.`
          );
          return [];
        }
      }
      throw error;
    }
  }

  async fetchFundingPayments(
    wallet: string,
    startDate: string,
    endDate: string
  ): Promise<HyperLiquidFunding[]> {
    try {
      const normalizedWallet = wallet.toLowerCase();
      console.log(
        `Fetching userFunding for wallet ${normalizedWallet} from ${this.baseUrl}`
      );
      // HyperLiquid API requires userFunding (not fundingHistory) with startTime/endTime in milliseconds
      const startTime = parseDate(startDate).getTime();
      const endTime = parseDate(endDate).getTime() + 86400000 - 1; // End of day in milliseconds

      const requestBody = {
        type: "userFunding",
        user: normalizedWallet,
        startTime: startTime,
        endTime: endTime,
      };
      console.log("Request body:", JSON.stringify(requestBody));

      const rawResponse = await fetchWithRetry(this.baseUrl, z.unknown(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Handle both array-wrapped and direct array responses
      let response: HyperLiquidFunding[];
      if (Array.isArray(rawResponse)) {
        if (rawResponse.length > 0 && Array.isArray(rawResponse[0])) {
          response = rawResponse[0] as HyperLiquidFunding[];
        } else if (
          rawResponse.length > 0 &&
          typeof rawResponse[0] === "object" &&
          rawResponse[0] !== null &&
          "data" in rawResponse[0]
        ) {
          response = (rawResponse[0] as { data: unknown })
            .data as HyperLiquidFunding[];
        } else {
          response = HyperLiquidFundingResponseSchema.parse(rawResponse);
        }
      } else if (
        typeof rawResponse === "object" &&
        rawResponse !== null &&
        "data" in rawResponse
      ) {
        response = (rawResponse as { data: unknown })
          .data as HyperLiquidFunding[];
        response = HyperLiquidFundingResponseSchema.parse(response);
      } else {
        response = HyperLiquidFundingResponseSchema.parse(rawResponse);
      }

      console.log(
        `Received ${response.length} funding payments before filtering`
      );
      // API already filters by time range, but we'll still filter by date to be safe
      const filtered = response.filter((funding) => {
        const fundingDate = timestampToDate(funding.time);
        return fundingDate >= startDate && fundingDate <= endDate;
      });
      console.log(
        `Received ${response.length} funding payments (already filtered by API time range)`
      );
      console.log(
        `Filtered to ${filtered.length} funding payments for date range ${startDate} to ${endDate}`
      );
      return filtered;
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(
          `Error fetching userFunding for wallet ${wallet}: ${error.statusCode} - ${error.message}`,
          error.details
        );
        // Handle 404 (not found) and 422 (unprocessable entity - likely wrong endpoint format)
        if (error.statusCode === 404 || error.statusCode === 422) {
          console.warn(
            `No funding data available for wallet ${wallet} (${error.statusCode}). Returning empty array.`
          );
          return [];
        }
      }
      throw error;
    }
  }

  async fetchClearinghouseState(
    wallet: string
  ): Promise<HyperLiquidClearinghouseState | null> {
    try {
      const normalizedWallet = wallet.toLowerCase();
      console.log(
        `Fetching clearinghouseState for wallet ${normalizedWallet} from ${this.baseUrl}`
      );
      // Try direct object format first (most common for HyperLiquid)
      const requestBody = {
        type: "clearinghouseState",
        user: normalizedWallet,
      };
      console.log("Request body:", JSON.stringify(requestBody));

      const rawResponse = await fetchWithRetry(this.baseUrl, z.unknown(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Handle both array-wrapped and direct object responses
      let response: HyperLiquidClearinghouseState;
      if (Array.isArray(rawResponse)) {
        if (
          rawResponse.length > 0 &&
          typeof rawResponse[0] === "object" &&
          rawResponse[0] !== null
        ) {
          if ("data" in rawResponse[0]) {
            response = (rawResponse[0] as { data: unknown })
              .data as HyperLiquidClearinghouseState;
          } else {
            response = rawResponse[0] as HyperLiquidClearinghouseState;
          }
        } else {
          throw new Error("Unexpected response format for clearinghouseState");
        }
      } else if (typeof rawResponse === "object" && rawResponse !== null) {
        if ("data" in rawResponse) {
          response = (rawResponse as { data: unknown })
            .data as HyperLiquidClearinghouseState;
        } else {
          response = rawResponse as HyperLiquidClearinghouseState;
        }
      } else {
        throw new Error("Unexpected response format for clearinghouseState");
      }

      response = HyperLiquidClearinghouseStateSchema.parse(response);
      console.log(
        `Successfully fetched clearinghouseState for wallet ${wallet}`
      );
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(
          `Error fetching clearinghouseState for wallet ${wallet}: ${error.statusCode} - ${error.message}`,
          error.details
        );
        if (error.statusCode === 404) {
          console.warn(
            `Clearinghouse state not found for wallet ${wallet} (404). This is normal if the wallet has no open positions.`
          );
        }
      } else {
        console.warn(
          `Failed to fetch clearinghouse state for wallet ${wallet}:`,
          error
        );
      }
      return null;
    }
  }

  getCurrentEquity(state: HyperLiquidClearinghouseState | null): number {
    if (!state) return 0;
    return state.marginSummary.accountValue;
  }

  getCurrentUnrealizedPnl(state: HyperLiquidClearinghouseState | null): number {
    if (!state) return 0;
    return state.assetPositions.reduce(
      (sum, pos) => sum + pos.position.unrealizedPnl,
      0
    );
  }
}
