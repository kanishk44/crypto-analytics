import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import type { TokenInfo, TokenInsight } from "../types/token.ts";
import { insightSchema } from "../types/token.ts";
import { AiServiceError } from "../types/errors.ts";
import { env } from "../config/env.ts";
import { logger } from "../utils/logger.ts";

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

function buildPrompt(token: TokenInfo): string {
  return `Analyze this crypto token and respond with ONLY valid JSON.

Token: ${token.name} (${token.symbol.toUpperCase()})
Price: $${token.market_data.current_price_usd.toLocaleString()}
Market Cap: $${token.market_data.market_cap_usd.toLocaleString()}
24h Change: ${token.market_data.price_change_percentage_24h.toFixed(2)}%
${token.market_data.price_change_percentage_7d !== undefined ? `7d Change: ${token.market_data.price_change_percentage_7d.toFixed(2)}%` : ""}

Response format (no markdown):
{"reasoning": "1 sentence analysis", "sentiment": "Bullish" or "Bearish" or "Neutral"}`;
}

export async function generateInsight(token: TokenInfo): Promise<TokenInsight> {
  const prompt = buildPrompt(token);

  logger.info("Generating AI insight", { tokenId: token.id, model: env.OPENROUTER_MODEL });

  const startTime = Date.now();

  try {
    const result = await generateText({
      model: openrouter(env.OPENROUTER_MODEL),
      prompt,
      maxTokens: 300,
      temperature: 0.2,
    });

    const duration = Date.now() - startTime;
    logger.info("AI response received", { tokenId: token.id, duration });

    // Parse and validate the response
    const text = result.text.trim();
    
    // Try to extract JSON if wrapped in code blocks
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.error("Failed to parse AI response as JSON", { response: text });
      throw new AiServiceError("AI returned invalid JSON response", { rawResponse: text });
    }

    const validated = insightSchema.safeParse(parsed);
    if (!validated.success) {
      logger.error("AI response failed validation", { 
        response: parsed, 
        errors: validated.error.flatten() 
      });
      throw new AiServiceError("AI response did not match expected schema", {
        rawResponse: parsed,
        validationErrors: validated.error.flatten(),
      });
    }

    return validated.data;
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    
    logger.error("AI service call failed", { 
      tokenId: token.id, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw new AiServiceError(
      "Failed to generate AI insight",
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

