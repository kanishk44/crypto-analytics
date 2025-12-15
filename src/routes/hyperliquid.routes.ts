import { Router, type Request, type Response, type NextFunction } from "express";
import { validateRequest } from "../middleware/validateRequest.ts";
import {
  pnlParamsSchema,
  pnlQuerySchema,
  type PnlParams,
  type PnlQuery,
  type WalletPnlResponse,
} from "../types/pnl.ts";
import { getWalletPnl } from "../services/walletPnl.service.ts";

const router = Router();

router.get(
  "/:wallet/pnl",
  validateRequest({
    params: pnlParamsSchema,
    query: pnlQuerySchema,
  }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { wallet } = req.params as PnlParams;
      const { start, end } = req.query as unknown as PnlQuery;

      const result: WalletPnlResponse = await getWalletPnl(wallet, start, end);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

