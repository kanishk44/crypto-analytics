import { describe, it } from "node:test";
import assert from "node:assert";
import { insightSchema } from "../types/token.ts";

describe("AI Insight Parsing", () => {
  describe("insightSchema validation", () => {
    it("accepts valid insight with Bullish sentiment", () => {
      const input = {
        reasoning: "Strong upward momentum with increasing volume.",
        sentiment: "Bullish",
      };

      const result = insightSchema.safeParse(input);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.reasoning, "Strong upward momentum with increasing volume.");
        assert.strictEqual(result.data.sentiment, "Bullish");
      }
    });

    it("accepts valid insight with Bearish sentiment", () => {
      const input = {
        reasoning: "Declining price with high selling pressure.",
        sentiment: "Bearish",
      };

      const result = insightSchema.safeParse(input);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.sentiment, "Bearish");
      }
    });

    it("accepts valid insight with Neutral sentiment", () => {
      const input = {
        reasoning: "Sideways movement with average volume.",
        sentiment: "Neutral",
      };

      const result = insightSchema.safeParse(input);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.sentiment, "Neutral");
      }
    });

    it("rejects invalid sentiment value", () => {
      const input = {
        reasoning: "Some analysis",
        sentiment: "VeryBullish",
      };

      const result = insightSchema.safeParse(input);
      assert.strictEqual(result.success, false);
    });

    it("rejects missing reasoning field", () => {
      const input = {
        sentiment: "Bullish",
      };

      const result = insightSchema.safeParse(input);
      assert.strictEqual(result.success, false);
    });

    it("rejects missing sentiment field", () => {
      const input = {
        reasoning: "Some analysis",
      };

      const result = insightSchema.safeParse(input);
      assert.strictEqual(result.success, false);
    });

    it("rejects non-object input", () => {
      const result = insightSchema.safeParse("not an object");
      assert.strictEqual(result.success, false);
    });

    it("rejects null input", () => {
      const result = insightSchema.safeParse(null);
      assert.strictEqual(result.success, false);
    });

    it("ignores extra fields", () => {
      const input = {
        reasoning: "Valid analysis",
        sentiment: "Bullish",
        extraField: "should be ignored",
      };

      const result = insightSchema.safeParse(input);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.deepStrictEqual(result.data, {
          reasoning: "Valid analysis",
          sentiment: "Bullish",
        });
      }
    });
  });

  describe("JSON parsing from AI response", () => {
    it("parses clean JSON response", () => {
      const aiResponse = '{"reasoning": "Market looks stable", "sentiment": "Neutral"}';
      
      const parsed = JSON.parse(aiResponse);
      const result = insightSchema.safeParse(parsed);
      
      assert.strictEqual(result.success, true);
    });

    it("extracts JSON from markdown code block", () => {
      const aiResponse = `Here is my analysis:
\`\`\`json
{"reasoning": "Strong buying pressure detected", "sentiment": "Bullish"}
\`\`\``;

      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      assert.notStrictEqual(jsonMatch, null);
      
      if (jsonMatch?.[1]) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        const result = insightSchema.safeParse(parsed);
        assert.strictEqual(result.success, true);
      }
    });

    it("handles JSON with escaped characters", () => {
      const aiResponse = '{"reasoning": "Price dropped 10% in \\"flash crash\\"", "sentiment": "Bearish"}';
      
      const parsed = JSON.parse(aiResponse);
      const result = insightSchema.safeParse(parsed);
      
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(result.data.reasoning.includes('"flash crash"'));
      }
    });

    it("handles multiline reasoning", () => {
      const aiResponse = `{
        "reasoning": "The token has shown significant volatility. Trading volume is above average.",
        "sentiment": "Neutral"
      }`;
      
      const parsed = JSON.parse(aiResponse);
      const result = insightSchema.safeParse(parsed);
      
      assert.strictEqual(result.success, true);
    });
  });
});
