import type { TokenInfo, TokenInsight } from "./token.ts";
import type { DailyPnl, PnlSummary, PnlDiagnostics } from "./pnl.ts";

// Row types for Supabase tables
export interface TokenInsightRow {
  id: string;
  token_id: string;
  vs_currency: string;
  history_days: number;
  token_json: TokenInfo;
  insight_json: TokenInsight;
  provider: string;
  model: string;
  created_at: string;
}

export interface WalletDailyPnlRow {
  id: string;
  wallet: string;
  start_date: string;
  end_date: string;
  daily: DailyPnl[];
  summary: PnlSummary;
  diagnostics: PnlDiagnostics;
  created_at: string;
}

// Insert types (without auto-generated fields)
export interface TokenInsightInsert {
  token_id: string;
  vs_currency: string;
  history_days: number;
  token_json: TokenInfo;
  insight_json: TokenInsight;
  provider: string;
  model: string;
}

export interface WalletDailyPnlInsert {
  wallet: string;
  start_date: string;
  end_date: string;
  daily: DailyPnl[];
  summary: PnlSummary;
  diagnostics: PnlDiagnostics;
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      token_insights: {
        Row: TokenInsightRow;
        Insert: TokenInsightInsert;
        Update: Partial<TokenInsightInsert>;
      };
      wallet_daily_pnls: {
        Row: WalletDailyPnlRow;
        Insert: WalletDailyPnlInsert;
        Update: Partial<WalletDailyPnlInsert>;
      };
    };
  };
}
