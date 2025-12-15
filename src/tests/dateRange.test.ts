import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getDateRange,
  getDayBounds,
  formatDate,
  isValidDate,
} from "../utils/dateRange.ts";

describe("Date Range Utilities", () => {
  describe("getDateRange", () => {
    it("returns single date for same start and end", () => {
      const result = getDateRange("2025-01-01", "2025-01-01");
      assert.deepStrictEqual(result, ["2025-01-01"]);
    });

    it("returns correct range for consecutive days", () => {
      const result = getDateRange("2025-01-01", "2025-01-03");
      assert.deepStrictEqual(result, ["2025-01-01", "2025-01-02", "2025-01-03"]);
    });

    it("handles month boundaries", () => {
      const result = getDateRange("2025-01-30", "2025-02-02");
      assert.deepStrictEqual(result, ["2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02"]);
    });

    it("handles year boundaries", () => {
      const result = getDateRange("2024-12-30", "2025-01-02");
      assert.deepStrictEqual(result, ["2024-12-30", "2024-12-31", "2025-01-01", "2025-01-02"]);
    });

    it("handles leap year", () => {
      const result = getDateRange("2024-02-28", "2024-03-01");
      assert.deepStrictEqual(result, ["2024-02-28", "2024-02-29", "2024-03-01"]);
    });
  });

  describe("getDayBounds", () => {
    it("returns correct start of day", () => {
      const { start } = getDayBounds("2025-01-15");
      const startDate = new Date(start);
      
      assert.strictEqual(startDate.getUTCHours(), 0);
      assert.strictEqual(startDate.getUTCMinutes(), 0);
      assert.strictEqual(startDate.getUTCSeconds(), 0);
      assert.strictEqual(startDate.getUTCMilliseconds(), 0);
    });

    it("returns correct end of day", () => {
      const { end } = getDayBounds("2025-01-15");
      const endDate = new Date(end);
      
      assert.strictEqual(endDate.getUTCHours(), 23);
      assert.strictEqual(endDate.getUTCMinutes(), 59);
      assert.strictEqual(endDate.getUTCSeconds(), 59);
      assert.strictEqual(endDate.getUTCMilliseconds(), 999);
    });

    it("start is before end", () => {
      const { start, end } = getDayBounds("2025-01-15");
      assert.ok(start < end);
    });
  });

  describe("formatDate", () => {
    it("formats Date object to YYYY-MM-DD", () => {
      const date = new Date("2025-01-15T12:30:00Z");
      assert.strictEqual(formatDate(date), "2025-01-15");
    });

    it("handles single digit months and days", () => {
      const date = new Date("2025-01-05T00:00:00Z");
      assert.strictEqual(formatDate(date), "2025-01-05");
    });
  });

  describe("isValidDate", () => {
    it("returns true for valid date format", () => {
      assert.strictEqual(isValidDate("2025-01-15"), true);
      assert.strictEqual(isValidDate("2024-12-31"), true);
      assert.strictEqual(isValidDate("2025-02-28"), true);
    });

    it("returns false for invalid format", () => {
      assert.strictEqual(isValidDate("01-15-2025"), false);
      assert.strictEqual(isValidDate("2025/01/15"), false);
      assert.strictEqual(isValidDate("2025-1-15"), false);
      assert.strictEqual(isValidDate("2025-01-5"), false);
    });

    it("returns false for invalid dates", () => {
      assert.strictEqual(isValidDate("2025-13-01"), false);
      assert.strictEqual(isValidDate("2025-00-01"), false);
      assert.strictEqual(isValidDate("not-a-date"), false);
    });
  });
});
