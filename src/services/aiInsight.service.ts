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
  return `You are a cryptocurrency market analyst. Analyze the following token data and provide a brief market insight.

Token: ${token.name} (${token.symbol.toUpperCase()})
Current Price: $${token.market_data.current_price_usd.toLocaleString()}
Market Cap: $${token.market_data.market_cap_usd.toLocaleString()}
24h Volume: $${token.market_data.total_volume_usd.toLocaleString()}
24h Price Change: ${token.market_data.price_change_percentage_24h.toFixed(2)}%
${token.market_data.price_change_percentage_7d !== undefined ? `7d Price Change: ${token.market_data.price_change_percentage_7d.toFixed(2)}%` : ""}
${token.market_data.price_change_percentage_30d !== undefined ? `30d Price Change: ${token.market_data.price_change_percentage_30d.toFixed(2)}%` : ""}

Respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{
  "reasoning": "A brief 1-2 sentence analysis of the current market conditions for this token",
  "sentiment": "Bullish" | "Bearish" | "Neutral"
}`;
}

export async function generateInsight(token: TokenInfo): Promise<TokenInsight> {
  const prompt = buildPrompt(token);

  logger.info("Generating AI insight", { tokenId: token.id, model: env.OPENROUTER_MODEL });

  const startTime = Date.now();

  try {
    const result = await generateText({
      model: openrouter(env.OPENROUTER_MODEL),
      prompt,
      maxTokens: 200,
      temperature: 0.3,
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

