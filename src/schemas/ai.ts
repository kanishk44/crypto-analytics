import { z } from 'zod';

export const AIInsightResponseSchema = z.object({
  reasoning: z.string().describe('Brief explanation or analysis of the token\'s current market state'),
  sentiment: z.enum(['Bullish', 'Bearish', 'Neutral']).describe('Overall market sentiment'),
  risk_level: z.enum(['Low', 'Medium', 'High']).optional().describe('Perceived risk level'),
  time_horizon: z.enum(['Short', 'Medium', 'Long']).optional().describe('Recommended time horizon for analysis'),
});

export type AIInsightResponse = z.infer<typeof AIInsightResponseSchema>;

