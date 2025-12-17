import db from "../database/db";
import { HyperLiquidService } from "./hyperliquid.service";
import { getToday } from "../utils/date";

export interface EquitySnapshot {
  id: number;
  wallet: string;
  date: string;
  equity_usd: number;
  unrealized_pnl_usd: number;
  account_value: number;
  total_margin_used: number;
  positions_count: number;
  snapshot_time: string;
  created_at: string;
}

export interface TrackedWallet {
  id: number;
  wallet: string;
  name: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export class EquitySnapshotService {
  private hyperliquidService: HyperLiquidService;

  constructor() {
    this.hyperliquidService = new HyperLiquidService();
  }

  /**
   * Capture and store current equity snapshot for a wallet
   */
  async captureSnapshot(wallet: string): Promise<EquitySnapshot | null> {
    const normalizedWallet = wallet.toLowerCase();
    const state = await this.hyperliquidService.fetchClearinghouseState(
      normalizedWallet
    );

    if (!state) {
      console.warn(`No clearinghouse state for wallet ${normalizedWallet}`);
      return null;
    }

    const today = getToday();
    const now = new Date().toISOString();

    const equity = state.marginSummary.accountValue;
    const unrealizedPnl = state.assetPositions.reduce(
      (sum, pos) => sum + pos.position.unrealizedPnl,
      0
    );

    const stmt = db.prepare(`
      INSERT INTO equity_snapshots (
        wallet, date, equity_usd, unrealized_pnl_usd, account_value,
        total_margin_used, positions_count, snapshot_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wallet, date) DO UPDATE SET
        equity_usd = excluded.equity_usd,
        unrealized_pnl_usd = excluded.unrealized_pnl_usd,
        account_value = excluded.account_value,
        total_margin_used = excluded.total_margin_used,
        positions_count = excluded.positions_count,
        snapshot_time = excluded.snapshot_time
      RETURNING *
    `);

    const result = stmt.get(
      normalizedWallet,
      today,
      equity,
      unrealizedPnl,
      state.marginSummary.accountValue,
      state.marginSummary.totalMarginUsed,
      state.assetPositions.length,
      now
    ) as EquitySnapshot;

    console.log(
      `Captured equity snapshot for ${normalizedWallet}: $${equity.toFixed(2)} on ${today}`
    );

    return result;
  }

  /**
   * Get stored equity snapshots for a wallet within a date range
   */
  getSnapshots(
    wallet: string,
    startDate: string,
    endDate: string
  ): EquitySnapshot[] {
    const normalizedWallet = wallet.toLowerCase();
    const stmt = db.prepare(`
      SELECT * FROM equity_snapshots
      WHERE wallet = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `);

    return stmt.all(normalizedWallet, startDate, endDate) as EquitySnapshot[];
  }

  /**
   * Get a single snapshot for a specific date
   */
  getSnapshot(wallet: string, date: string): EquitySnapshot | null {
    const normalizedWallet = wallet.toLowerCase();
    const stmt = db.prepare(`
      SELECT * FROM equity_snapshots
      WHERE wallet = ? AND date = ?
    `);

    return (stmt.get(normalizedWallet, date) as EquitySnapshot) || null;
  }

  /**
   * Get the most recent snapshot for a wallet
   */
  getLatestSnapshot(wallet: string): EquitySnapshot | null {
    const normalizedWallet = wallet.toLowerCase();
    const stmt = db.prepare(`
      SELECT * FROM equity_snapshots
      WHERE wallet = ?
      ORDER BY date DESC
      LIMIT 1
    `);

    return (stmt.get(normalizedWallet) as EquitySnapshot) || null;
  }

  /**
   * Add a wallet to the tracking list
   */
  addTrackedWallet(wallet: string, name?: string): TrackedWallet {
    const normalizedWallet = wallet.toLowerCase();
    const stmt = db.prepare(`
      INSERT INTO tracked_wallets (wallet, name)
      VALUES (?, ?)
      ON CONFLICT(wallet) DO UPDATE SET
        active = 1,
        name = COALESCE(excluded.name, tracked_wallets.name),
        updated_at = datetime('now')
      RETURNING *
    `);

    return stmt.get(normalizedWallet, name || null) as TrackedWallet;
  }

  /**
   * Remove a wallet from tracking (soft delete)
   */
  removeTrackedWallet(wallet: string): boolean {
    const normalizedWallet = wallet.toLowerCase();
    const stmt = db.prepare(`
      UPDATE tracked_wallets
      SET active = 0, updated_at = datetime('now')
      WHERE wallet = ?
    `);

    const result = stmt.run(normalizedWallet);
    return result.changes > 0;
  }

  /**
   * Get all active tracked wallets
   */
  getTrackedWallets(): TrackedWallet[] {
    const stmt = db.prepare(`
      SELECT * FROM tracked_wallets
      WHERE active = 1
      ORDER BY created_at ASC
    `);

    return stmt.all() as TrackedWallet[];
  }

  /**
   * Capture snapshots for all tracked wallets
   */
  async captureAllSnapshots(): Promise<{
    success: number;
    failed: number;
    wallets: string[];
  }> {
    const wallets = this.getTrackedWallets();
    let success = 0;
    let failed = 0;
    const successWallets: string[] = [];

    for (const trackedWallet of wallets) {
      try {
        const snapshot = await this.captureSnapshot(trackedWallet.wallet);
        if (snapshot) {
          success++;
          successWallets.push(trackedWallet.wallet);
        } else {
          failed++;
        }
      } catch (error) {
        console.error(
          `Failed to capture snapshot for ${trackedWallet.wallet}:`,
          error
        );
        failed++;
      }
    }

    return { success, failed, wallets: successWallets };
  }

  /**
   * Build equity map for date range, using stored snapshots where available
   * Falls back to reconstruction for missing dates
   */
  buildEquityMap(
    wallet: string,
    dates: string[],
    currentEquity: number | null
  ): Map<string, number | null> {
    // Handle empty dates array - return empty map
    if (dates.length === 0) {
      return new Map<string, number | null>();
    }

    const startDate = dates[0]!;
    const endDate = dates[dates.length - 1]!;

    const snapshots = this.getSnapshots(wallet, startDate, endDate);
    const snapshotMap = new Map<string, number>();

    for (const snapshot of snapshots) {
      snapshotMap.set(snapshot.date, snapshot.equity_usd);
    }

    const equityMap = new Map<string, number | null>();
    const today = getToday();

    // Set known values from snapshots
    for (const date of dates) {
      if (snapshotMap.has(date)) {
        equityMap.set(date, snapshotMap.get(date)!);
      } else if (date === today && currentEquity !== null) {
        equityMap.set(date, currentEquity);
      } else {
        equityMap.set(date, null); // Unknown - will need reconstruction or stay null
      }
    }

    return equityMap;
  }
}

