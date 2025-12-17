import { z } from "zod";

export const HyperLiquidFillSchema = z.object({
  closedPnl: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 0)),
  fee: z.string().transform((val) => parseFloat(val)),
  px: z.string().transform((val) => parseFloat(val)),
  sz: z.string().transform((val) => parseFloat(val)),
  side: z.enum(["A", "B"]), // "B" = Bid/Buy, "A" = Ask/Sell
  time: z.number(),
  coin: z.string(),
  oid: z.number(),
  startPosition: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 0)),
  dir: z.string(),
  hash: z.string(),
  tid: z.number(),
});

export type HyperLiquidFill = z.infer<typeof HyperLiquidFillSchema>;

export const HyperLiquidUserFillsResponseSchema = z.array(
  HyperLiquidFillSchema
);

// userFunding endpoint returns: { delta: { coin, fundingRate, szi, type, usdc }, hash, time }
export const HyperLiquidFundingSchema = z.object({
  delta: z.object({
    coin: z.string(),
    fundingRate: z.string().transform((val) => parseFloat(val)),
    szi: z.string().transform((val) => parseFloat(val)),
    type: z.literal("funding"),
    usdc: z.string().transform((val) => parseFloat(val)), // This is the funding payment amount
  }),
  hash: z.string(),
  time: z.number(),
});

export type HyperLiquidFunding = z.infer<typeof HyperLiquidFundingSchema>;

export const HyperLiquidFundingResponseSchema = z.array(
  HyperLiquidFundingSchema
);

export const HyperLiquidClearinghouseStateSchema = z.object({
  assetPositions: z.array(
    z.object({
      position: z.object({
        coin: z.string(),
        entryPx: z.string().transform((val) => parseFloat(val)),
        leverage: z.object({
          type: z.enum(["isolated", "cross"]),
          value: z
            .union([z.string(), z.number()])
            .transform((val) =>
              typeof val === "string" ? parseFloat(val) : val
            ),
          rawUsd: z
            .union([z.string(), z.number()])
            .optional()
            .transform((val) =>
              val === undefined
                ? 0
                : typeof val === "string"
                  ? parseFloat(val)
                  : val
            ),
        }),
        liquidationPx: z
          .string()
          .nullable()
          .transform((val) => (val ? parseFloat(val) : null)),
        marginUsed: z.string().transform((val) => parseFloat(val)),
        maxLeverage: z
          .union([z.string(), z.number()])
          .transform((val) =>
            typeof val === "string" ? parseFloat(val) : val
          ),
        returnOnEquity: z.string().transform((val) => parseFloat(val)),
        szi: z.string().transform((val) => parseFloat(val)),
        unrealizedPnl: z.string().transform((val) => parseFloat(val)),
      }),
    })
  ),
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

export type HyperLiquidClearinghouseState = z.infer<
  typeof HyperLiquidClearinghouseStateSchema
>;
