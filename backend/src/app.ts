import express, { type Application } from 'express';
import cors from 'cors';
import env from './config/env.js';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import productRoutes from './routes/products.js';
import stockRoutes from './routes/stock.js';
import challanRoutes from './routes/challans.js';
import dashboardRoutes from './routes/dashboard.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  const allowedOrigins = env.frontendUrl
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'OK' });
  });

  app.use('/auth', authRoutes);
  app.use('/customers', customerRoutes);
  app.use('/products', productRoutes);
  app.use('/stock', stockRoutes);
  app.use('/challans', challanRoutes);
  app.use('/dashboard', dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}