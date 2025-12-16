import { Router } from 'express';
import { HyperLiquidPnlController } from '../controllers/hyperliquidPnl.controller';
import { validateParams, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import { HyperLiquidPnlQuerySchema } from '../schemas/api';

const router = Router();
const controller = new HyperLiquidPnlController();

const paramsSchema = z.object({
  wallet: z.string().min(1),
});

router.get(
  '/:wallet/pnl',
  validateParams(paramsSchema),
  validateQuery(HyperLiquidPnlQuerySchema),
  controller.getWalletPnl.bind(controller)
);

export default router;

