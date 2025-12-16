import { z } from 'zod';

export const HyperLiquidFillSchema = z.object({
  closedPnl: z.string().optional().transform((val) => (val ? parseFloat(val) : 0)),
  fee: z.string().transform((val) => parseFloat(val)),
  px: z.string().transform((val) => parseFloat(val)),
  sz: z.string().transform((val) => parseFloat(val)),
  side: z.enum(['A', 'B']),
  time: z.number(),
  coin: z.string(),
  isBuy: z.boolean(),
  oid: z.number(),
  startPosition: z.string().transform((val) => parseFloat(val)),
  dir: z.string(),
  hash: z.string(),
  tid: z.number(),
});

export type HyperLiquidFill = z.infer<typeof HyperLiquidFillSchema>;

export const HyperLiquidUserFillsResponseSchema = z.array(HyperLiquidFillSchema);

export const HyperLiquidFundingSchema = z.object({
  coin: z.string(),
  fundingRate: z.string().transform((val) => parseFloat(val)),
  premium: z.string().transform((val) => parseFloat(val)),
  time: z.number(),
  user: z.string(),
});

export type HyperLiquidFunding = z.infer<typeof HyperLiquidFundingSchema>;

export const HyperLiquidFundingResponseSchema = z.array(HyperLiquidFundingSchema);

export const HyperLiquidClearinghouseStateSchema = z.object({
  assetPositions: z.array(z.object({
    position: z.object({
      coin: z.string(),
      entryPx: z.string().transform((val) => parseFloat(val)),
      leverage: z.object({
        value: z.string().transform((val) => parseFloat(val)),
      }),
      liquidationPx: z.string().nullable().transform((val) => (val ? parseFloat(val) : null)),
      marginUsed: z.string().transform((val) => parseFloat(val)),
      maxLeverage: z.object({
        value: z.string().transform((val) => parseFloat(val)),
      }),
      returnOnEquity: z.string().transform((val) => parseFloat(val)),
      szi: z.string().transform((val) => parseFloat(val)),
      unrealizedPnl: z.string().transform((val) => parseFloat(val)),
    }),
  })),
  crossMaintenanceMarginUsed: z.string().transform((val) => parseFloat(val)),
  crossMarginSummary: z.object({
    accountValue: z.string().transform((val) => parseFloat(val)),
    totalMarginUsed: z.string().transform((val) => parseFloat(val)),
    totalNtlPos: z.string().transform((val) => parseFloat(val)),
    totalRawUsd: z.string().transform((val) => parseFloat(val)),
  }),
  marginSummary: z.object({
    accountValue: z.string().transform((val) => parseFloat(val)),
    totalMarginUsed: z.string().transform((val) => parseFloat(val)),
    totalNtlPos: z.string().transform((val) => parseFloat(val)),
    totalRawUsd: z.string().transform((val) => parseFloat(val)),
  }),
});

export type HyperLiquidClearinghouseState = z.infer<typeof HyperLiquidClearinghouseStateSchema>;

