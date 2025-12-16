import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler } from './utils/errors';
import tokenInsightRoutes from './routes/tokenInsight.routes';
import hyperliquidPnlRoutes from './routes/hyperliquidPnl.routes';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/token', tokenInsightRoutes);
  app.use('/api/hyperliquid', hyperliquidPnlRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(errorHandler);

  return app;
}

