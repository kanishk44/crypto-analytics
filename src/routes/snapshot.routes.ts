import { Router, Request, Response, NextFunction } from "express";
import { EquitySnapshotService } from "../services/equitySnapshot.service";

const router = Router();
const equitySnapshotService = new EquitySnapshotService();

// ============================================================================
// FIXED PATHS (must come before parameterized routes)
// ============================================================================

/**
 * GET /api/snapshots/tracked/list
 * Get all tracked wallets
 */
router.get(
  "/tracked/list",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const wallets = equitySnapshotService.getTrackedWallets();

      res.json({
        wallets,
        count: wallets.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/snapshots/capture-all
 * Manually trigger equity snapshot capture for all tracked wallets
 */
router.post(
  "/capture-all",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await equitySnapshotService.captureAllSnapshots();

      res.json({
        message: "Snapshot capture complete",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// PARAMETERIZED PATHS (must come after fixed paths)
// ============================================================================

/**
 * POST /api/snapshots/capture/:wallet
 * Manually trigger equity snapshot capture for a wallet
 */
router.post(
  "/capture/:wallet",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = req.params.wallet;

      if (!wallet) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }

      const snapshot = await equitySnapshotService.captureSnapshot(wallet);

      if (!snapshot) {
        res.status(404).json({
          error: "Could not capture snapshot",
          message:
            "No clearinghouse state available for this wallet. The wallet may have no positions or balance.",
        });
        return;
      }

      res.json({
        message: "Snapshot captured successfully",
        snapshot,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/snapshots/track/:wallet
 * Add a wallet to the tracking list
 */
router.post(
  "/track/:wallet",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = req.params.wallet;
      const { name } = req.body;

      if (!wallet) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }

      const trackedWallet = equitySnapshotService.addTrackedWallet(wallet, name);

      // Also capture initial snapshot
      const snapshot = await equitySnapshotService.captureSnapshot(wallet);

      res.json({
        message: "Wallet added to tracking",
        trackedWallet,
        initialSnapshot: snapshot,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/snapshots/track/:wallet
 * Remove a wallet from the tracking list
 */
router.delete(
  "/track/:wallet",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = req.params.wallet;

      if (!wallet) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }

      const removed = equitySnapshotService.removeTrackedWallet(wallet);

      if (!removed) {
        res.status(404).json({ error: "Wallet not found in tracking list" });
        return;
      }

      res.json({
        message: "Wallet removed from tracking",
        wallet: wallet.toLowerCase(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/snapshots/:wallet
 * Get stored equity snapshots for a wallet
 * NOTE: This must be LAST because /:wallet is a catch-all parameter
 */
router.get(
  "/:wallet",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wallet = req.params.wallet;
      const { start, end } = req.query;

      if (!wallet) {
        res.status(400).json({ error: "Wallet address is required" });
        return;
      }

      if (!start || !end) {
        res
          .status(400)
          .json({ error: "Start and end dates are required (YYYY-MM-DD)" });
        return;
      }

      const snapshots = equitySnapshotService.getSnapshots(
        wallet,
        start as string,
        end as string
      );

      res.json({
        wallet: wallet.toLowerCase(),
        start,
        end,
        snapshots,
        count: snapshots.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
