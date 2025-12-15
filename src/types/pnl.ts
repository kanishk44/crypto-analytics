import { z } from "zod";
import { dateSchema, walletAddressSchema } from "../middleware/validateRequest.ts";

// Request schemas
export const pnlParamsSchema = z.object({
  wallet: walletAddressSchema,
});

export const pnlQuerySchema = z.object({
  start: dateSchema,
  end: dateSchema,
}).refine(
  (data) => new Date(data.start) <= new Date(data.end),
  { message: "Start date must be before or equal to end date" }
);

export type PnlParams = z.infer<typeof pnlParamsSchema>;
export type PnlQuery = z.infer<typeof pnlQuerySchema>;

// Daily PnL data
export interface DailyPnl {
  date: string;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  fees_usd: number;
  funding_usd: number;
  net_pnl_usd: number;
  equity_usd: number;
}

// Summary
export interface PnlSummary {
  total_realized_usd: number;
  total_unrealized_usd: number;
  total_fees_usd: number;
  total_funding_usd: number;
  net_pnl_usd: number;
}

// Diagnostics
export interface PnlDiagnostics {
  data_source: string;
  last_api_call: string;
  notes: string;
}

// API Response
export interface WalletPnlResponse {
  wallet: string;
  start: string;
  end: string;
  daily: DailyPnl[];
  summary: PnlSummary;
  diagnostics: PnlDiagnostics;
}

