// HyperLiquid API response types

export interface HyperLiquidTrade {
  coin: string;
  side: "B" | "S"; // Buy or Sell
  px: string; // Price
  sz: string; // Size
  time: number; // Unix timestamp ms
  hash: string;
  fee: string;
  feeToken: string;
  closedPnl?: string;
}

export interface HyperLiquidPosition {
  coin: string;
  szi: string; // Signed size (negative for short)
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  leverage: {
    type: string;
    value: number;
  };
  liquidationPx: string | null;
  marginUsed: string;
  maxLeverage: number;
}

export interface HyperLiquidFundingEntry {
  coin: string;
  fundingRate: string;
  premium: string;
  time: number;
  usdc: string;
}

export interface HyperLiquidUserState {
  assetPositions: Array<{
    position: HyperLiquidPosition;
    type: string;
  }>;
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
}

export interface HyperLiquidFillsResponse {
  fills: HyperLiquidTrade[];
}

export interface HyperLiquidFundingResponse {
  funding: HyperLiquidFundingEntry[];
}

// Normalized internal types
export interface NormalizedTrade {
  coin: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  timestamp: Date;
  fee: number;
  closedPnl: number;
}

export interface NormalizedPosition {
  coin: string;
  size: number; // Negative for short
  entryPrice: number;
  unrealizedPnl: number;
  positionValue: number;
}

export interface NormalizedFunding {
  coin: string;
  amount: number;
  timestamp: Date;
}

export interface DailyTradingData {
  date: string;
  trades: NormalizedTrade[];
  positions: NormalizedPosition[];
  fundingPayments: NormalizedFunding[];
  totalFees: number;
  totalFunding: number;
  realizedPnl: number;
}

