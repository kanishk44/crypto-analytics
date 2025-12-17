import cron from "node-cron";
import { EquitySnapshotService } from "../services/equitySnapshot.service";

const equitySnapshotService = new EquitySnapshotService();

/**
 * Daily equity snapshot cron job
 * Runs every day at 23:55 UTC to capture end-of-day equity for all tracked wallets
 */
export function startSnapshotCron(): void {
  // Run at 23:55 UTC every day (just before midnight to capture "today's" equity)
  cron.schedule(
    "55 23 * * *",
    async () => {
      console.log("[Cron] Starting daily equity snapshot capture...");
      const startTime = Date.now();

      try {
        const result = await equitySnapshotService.captureAllSnapshots();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(
          `[Cron] Equity snapshot complete in ${duration}s: ${result.success} success, ${result.failed} failed`
        );

        if (result.wallets.length > 0) {
          console.log(`[Cron] Captured wallets: ${result.wallets.join(", ")}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[Cron] Failed to capture equity snapshots: ${errorMessage}`
        );
      }
    },
    {
      timezone: "UTC",
    }
  );

  console.log("[Cron] Equity snapshot cron job scheduled (daily at 23:55 UTC)");
}

/**
 * Also run every hour during the day to catch any missed snapshots
 * and update current day's equity with latest values
 */
export function startHourlySnapshotCron(): void {
  // Run every hour at minute 0
  cron.schedule(
    "0 * * * *",
    async () => {
      console.log("[Cron] Running hourly equity update...");

      try {
        const result = await equitySnapshotService.captureAllSnapshots();
        console.log(
          `[Cron] Hourly update: ${result.success} wallets updated`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[Cron] Hourly update failed: ${errorMessage}`);
      }
    },
    {
      timezone: "UTC",
    }
  );

  console.log("[Cron] Hourly equity update cron job scheduled");
}

/**
 * Start all cron jobs
 */
export function startAllCronJobs(): void {
  startSnapshotCron();
  startHourlySnapshotCron();
}

