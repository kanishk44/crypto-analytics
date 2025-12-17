import { env } from '../config/env';
import { AIInsightResponseSchema, type AIInsightResponse } from '../schemas/ai';
import { CoinGeckoTokenDetails } from '../schemas/coingecko';
import { fetchWithTimeout, HttpError } from '../utils/http';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class AIService {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(model = env.OPENROUTER_MODEL, apiKey = env.OPENROUTER_API_KEY) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async generateTokenInsight(
    tokenData: CoinGeckoTokenDetails,
    marketChartData?: { prices: Array<[number, number]> }
  ): Promise<AIInsightResponse> {
    const prompt = this.buildPrompt(tokenData, marketChartData);

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://crypto-analytics.local',
            'X-Title': 'Crypto Analytics API',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        },
        30000
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new HttpError(response.status, `OpenRouter API error: ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;
      const text = data.choices[0]?.message?.content?.trim() ?? '';

      if (!text) {
        throw new Error('Empty response from AI');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      }

      return AIInsightResponseSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('validation') || error.message.includes('ZodError') || error.message.includes('JSON'))) {
        return this.getFallbackResponse(tokenData);
      }
      throw error;
    }
  }

  private buildPrompt(
    tokenData: CoinGeckoTokenDetails,
    marketChartData?: { prices: Array<[number, number]> }
  ): string {
    const marketData = tokenData.market_data;
    const priceChange = marketData.price_change_percentage_24h ?? 0;
    const priceChangeStr = priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`;
    const currentPrice = marketData.current_price.usd;
    const marketCap = marketData.market_cap.usd;
    const totalVolume = marketData.total_volume.usd;

    let prompt = `Analyze the following cryptocurrency token data and provide a structured JSON insight.

Token: ${tokenData.name} (${tokenData.symbol.toUpperCase()})
Current Price (USD): $${currentPrice?.toFixed(2) ?? 'N/A'}
Market Cap (USD): $${marketCap ? (marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
24h Volume (USD): $${totalVolume ? (totalVolume / 1e6).toFixed(2) + 'M' : 'N/A'}
24h Price Change: ${priceChangeStr}
`;

    if (marketChartData && marketChartData.prices.length > 0) {
      const prices = marketChartData.prices;
      const firstPrice = prices[0]?.[1] ?? 0;
      const lastPrice = prices[prices.length - 1]?.[1] ?? 0;
      const periodChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
      prompt += `Historical Context: Price change over the requested period: ${periodChange >= 0 ? '+' : ''}${periodChange.toFixed(2)}%\n`;
    }

    prompt += `
You MUST respond with ONLY a valid JSON object matching this exact schema:
{
  "reasoning": "Brief explanation or analysis (2-3 sentences)",
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "risk_level": "Low" | "Medium" | "High" (optional),
  "time_horizon": "Short" | "Medium" | "Long" (optional)
}

Do NOT include any markdown formatting, code blocks, or explanatory text outside the JSON object.
Respond with ONLY the JSON object.`;

    return prompt;
  }

  private getFallbackResponse(tokenData: CoinGeckoTokenDetails): AIInsightResponse {
    const priceChange = tokenData.market_data.price_change_percentage_24h ?? 0;
    const currentPrice = tokenData.market_data.current_price.usd;
    let sentiment: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
    if (priceChange > 5) sentiment = 'Bullish';
    else if (priceChange < -5) sentiment = 'Bearish';

    return {
      reasoning: `Token ${tokenData.name} (${tokenData.symbol}) is currently trading at $${currentPrice?.toFixed(2) ?? 'N/A'} with a 24h change of ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%. Market data analysis indicates ${sentiment.toLowerCase()} sentiment.`,
      sentiment,
      risk_level: 'Medium',
      time_horizon: 'Medium',
    };
  }
}

