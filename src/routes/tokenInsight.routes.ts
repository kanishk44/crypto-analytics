import { Router } from 'express';
import { TokenInsightController } from '../controllers/tokenInsight.controller';
import { validateParams, validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const controller = new TokenInsightController();

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  vs_currency: z.string().optional(),
  history_days: z.number().int().min(1).max(365).optional(),
}).optional();

router.post(
  '/:id/insight',
  validateParams(paramsSchema),
  validateBody(bodySchema),
  controller.getTokenInsight.bind(controller)
);

export default router;

