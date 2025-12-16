import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateDailyPnl,
  calculateNetPnl,
  calculateEquity,
} from "../services/pnlCalculation.service.ts";
import type { WalletData } from "../services/hyperliquid.service.ts";

// Helper to create empty wallet data
function createEmptyWalletData(overrides: Partial<WalletData> = {}): WalletData {
  return {
    trades: [],
    positions: [],
    spotBalances: [],
    fundingPayments: [],
    accountValue: 10000,
    spotAccountValue: 0,
    ...overrides,
  };
}

describe("PnL Calculation", () => {
  describe("calculateNetPnl", () => {
    it("calculates net PnL correctly with all positive values", () => {
      const result = calculateNetPnl(100, 50, 10, 5);
      // net = realized + unrealized - fees + funding
      // net = 100 + 50 - 10 + 5 = 145
      assert.strictEqual(result, 145);
    });

    it("calculates net PnL correctly with negative values", () => {
      const result = calculateNetPnl(-50, -20, 5, -10);
      // net = -50 + (-20) - 5 + (-10) = -85
      assert.strictEqual(result, -85);
    });

    it("calculates net PnL correctly with zero values", () => {
      const result = calculateNetPnl(0, 0, 0, 0);
      assert.strictEqual(result, 0);
    });

    it("handles mixed positive and negative values", () => {
      const result = calculateNetPnl(100, -30, 15, -5);
      // net = 100 + (-30) - 15 + (-5) = 50
      assert.strictEqual(result, 50);
    });
  });

  describe("calculateEquity", () => {
    it("calculates equity correctly", () => {
      const result = calculateEquity(10000, 100, 10, 5, 50);
      // equity = base + realized - fees + funding + unrealized
      // equity = 10000 + 100 - 10 + 5 + 50 = 10145
      assert.strictEqual(result, 10145);
    });

    it("handles negative unrealized PnL", () => {
      const result = calculateEquity(10000, 50, 5, 0, -100);
      // equity = 10000 + 50 - 5 + 0 + (-100) = 9945
      assert.strictEqual(result, 9945);
    });
  });

  describe("calculateDailyPnl", () => {
    it("returns empty array for empty dates", () => {
      const walletData = createEmptyWalletData();
      const result = calculateDailyPnl([], walletData);
      assert.deepStrictEqual(result, []);
    });

    it("calculates daily PnL for single day with no activity", () => {
      const walletData = createEmptyWalletData();
      const result = calculateDailyPnl(["2025-01-01"], walletData);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]!.date, "2025-01-01");
      assert.strictEqual(result[0]!.realized_pnl_usd, 0);
      assert.strictEqual(result[0]!.unrealized_pnl_usd, 0);
      assert.strictEqual(result[0]!.fees_usd, 0);
      assert.strictEqual(result[0]!.funding_usd, 0);
      assert.strictEqual(result[0]!.net_pnl_usd, 0);
      assert.strictEqual(result[0]!.equity_usd, 10000);
      // Check market breakdowns exist
      assert.ok(result[0]!.perp);
      assert.ok(result[0]!.spot);
    });

    it("calculates daily PnL with perp trades", () => {
      const walletData = createEmptyWalletData({
        trades: [
          {
            coin: "BTC",
            side: "sell",
            price: 50000,
            size: 0.1,
            timestamp: new Date("2025-01-01T12:00:00Z"),
            fee: 5,
            closedPnl: 100,
            market: "perp",
          },
        ],
      });

      const result = calculateDailyPnl(["2025-01-01"], walletData);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]!.realized_pnl_usd, 100);
      assert.strictEqual(result[0]!.fees_usd, 5);
      assert.strictEqual(result[0]!.perp.realized_pnl_usd, 100);
      assert.strictEqual(result[0]!.perp.fees_usd, 5);
      assert.strictEqual(result[0]!.spot.realized_pnl_usd, 0);
    });

    it("calculates daily PnL with funding payments", () => {
      const walletData = createEmptyWalletData({
        fundingPayments: [
          {
            coin: "BTC",
            amount: -2.5,
            timestamp: new Date("2025-01-01T08:00:00Z"),
          },
          {
            coin: "ETH",
            amount: 1.5,
            timestamp: new Date("2025-01-01T16:00:00Z"),
          },
        ],
      });

      const result = calculateDailyPnl(["2025-01-01"], walletData);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]!.funding_usd, -1); // -2.5 + 1.5
    });

    it("includes unrealized PnL only on last day", () => {
      const walletData = createEmptyWalletData({
        positions: [
          {
            coin: "BTC",
            size: 0.5,
            entryPrice: 48000,
            unrealizedPnl: 500,
            positionValue: 25000,
            market: "perp",
          },
        ],
        accountValue: 10500,
      });

      const result = calculateDailyPnl(["2025-01-01", "2025-01-02"], walletData);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0]!.unrealized_pnl_usd, 0); // First day
      assert.strictEqual(result[1]!.unrealized_pnl_usd, 500); // Last day
      assert.strictEqual(result[1]!.perp.unrealized_pnl_usd, 500);
    });

    it("calculates running equity across multiple days", () => {
      const walletData = createEmptyWalletData({
        trades: [
          {
            coin: "BTC",
            side: "sell",
            price: 50000,
            size: 0.1,
            timestamp: new Date("2025-01-01T12:00:00Z"),
            fee: 5,
            closedPnl: 100,
            market: "perp",
          },
          {
            coin: "BTC",
            side: "sell",
            price: 51000,
            size: 0.1,
            timestamp: new Date("2025-01-02T12:00:00Z"),
            fee: 5,
            closedPnl: 200,
            market: "perp",
          },
        ],
      });

      const result = calculateDailyPnl(["2025-01-01", "2025-01-02"], walletData);

      assert.strictEqual(result.length, 2);
      // Day 1: base equity + realized - fees = 10000 + 100 - 5 = 10095
      assert.strictEqual(result[0]!.equity_usd, 10095);
      // Day 2: 10095 + 200 - 5 = 10290
      assert.strictEqual(result[1]!.equity_usd, 10290);
    });

    it("handles spot trades separately", () => {
      const walletData = createEmptyWalletData({
        trades: [
          {
            coin: "BTC",
            side: "sell",
            price: 50000,
            size: 0.1,
            timestamp: new Date("2025-01-01T12:00:00Z"),
            fee: 5,
            closedPnl: 100,
            market: "perp",
          },
          {
            coin: "PURR",
            side: "sell",
            price: 1.5,
            size: 100,
            timestamp: new Date("2025-01-01T14:00:00Z"),
            fee: 0.5,
            closedPnl: 0, // Spot doesn't have closedPnl from API
            market: "spot",
          },
        ],
      });

      const result = calculateDailyPnl(["2025-01-01"], walletData);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]!.perp.realized_pnl_usd, 100);
      assert.strictEqual(result[0]!.perp.fees_usd, 5);
      assert.strictEqual(result[0]!.spot.fees_usd, 0.5);
      assert.strictEqual(result[0]!.fees_usd, 5.5); // Combined
    });
  });
});
