import { Router, type Request, type Response, type NextFunction } from "express";
import { validateRequest } from "../middleware/validateRequest.ts";
import {
  tokenInsightParamsSchema,
  tokenInsightBodySchema,
  type TokenInsightParams,
  type TokenInsightBody,
  type TokenInsightResponse,
} from "../types/token.ts";
import { getTokenInsight } from "../services/tokenInsight.service.ts";

const router = Router();

router.post(
  "/:id/insight",
  validateRequest({
    params: tokenInsightParamsSchema,
    body: tokenInsightBodySchema,
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as TokenInsightParams;
      const body = (req.body ?? { vs_currency: "usd", history_days: 30 }) as NonNullable<TokenInsightBody>;
      
      const result: TokenInsightResponse = await getTokenInsight(
        id,
        body.vs_currency ?? "usd",
        body.history_days ?? 30
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

