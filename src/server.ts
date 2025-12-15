import express, { type Request, type Response } from "express";
import { env } from "./config/env.ts";
import { errorHandler } from "./middleware/errorHandler.ts";
import { logger } from "./utils/logger.ts";
import tokenInsightRoutes from "./routes/tokenInsight.routes.ts";
import hyperliquidRoutes from "./routes/hyperliquid.routes.ts";

const app = express();

// Middleware
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API Routes
app.use("/api/token", tokenInsightRoutes);
app.use("/api/hyperliquid", hyperliquidRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "The requested endpoint does not exist",
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(env.PORT, () => {
  logger.info(`Server started`, {
    port: env.PORT,
    environment: env.NODE_ENV,
  });
});

export default app;

