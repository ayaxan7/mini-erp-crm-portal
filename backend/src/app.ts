import express, { type Application } from 'express';
import cors from 'cors';
import env from './config/env.js';
import { pool } from './config/db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { S3ImageStorage, LocalImageStorage, isS3Configured, UPLOADS_DIR } from './services/storage.service.js';

import { UserRepository } from './repositories/user.repo.js';
import { AccessRequestRepository } from './repositories/access-request.repo.js';
import { CustomerRepository } from './repositories/customer.repo.js';
import { ProductRepository } from './repositories/product.repo.js';
import { StockRepository } from './repositories/stock.repo.js';
import { ChallanRepository } from './repositories/challan.repo.js';
import { DashboardRepository } from './repositories/dashboard.repo.js';

import { AuthService } from './services/auth.service.js';
import { AccessRequestService } from './services/access-request.service.js';
import { CustomerService } from './services/customer.service.js';
import { ProductService } from './services/product.service.js';
import { StockService } from './services/stock.service.js';
import { ChallanService } from './services/challan.service.js';
import { DashboardService } from './services/dashboard.service.js';
import { InvoiceService } from './services/invoice.service.js';

import { AuthController } from './controllers/auth.controller.js';
import { AccessRequestController } from './controllers/access-request.controller.js';
import { CustomerController } from './controllers/customer.controller.js';
import { ProductController } from './controllers/product.controller.js';
import { StockController } from './controllers/stock.controller.js';
import { ChallanController } from './controllers/challan.controller.js';
import { DashboardController } from './controllers/dashboard.controller.js';

import { authRouter } from './routes/auth.route.js';
import { customerRouter } from './routes/customers.route.js';
import { productRouter } from './routes/products.route.js';
import { stockRouter } from './routes/stock.route.js';
import { challanRouter } from './routes/challans.route.js';
import { dashboardRouter } from './routes/dashboard.route.js';

export function createApp(): Application {
  const userRepo = new UserRepository(pool);
  const accessRequestRepo = new AccessRequestRepository(pool);
  const customerRepo = new CustomerRepository(pool);
  const productRepo = new ProductRepository(pool);
  const stockRepo = new StockRepository(pool);
  const challanRepo = new ChallanRepository(pool);
  const dashboardRepo = new DashboardRepository(pool);

  const authService = new AuthService(userRepo);
  const accessRequestService = new AccessRequestService(accessRequestRepo, userRepo);
  const customerService = new CustomerService(customerRepo);
  const imageStorage = isS3Configured(env)
    ? new S3ImageStorage(env.s3Bucket!, env.awsRegion!, env.awsAccessKeyId!, env.awsSecretAccessKey!)
    : new LocalImageStorage(UPLOADS_DIR, '/uploads');
  const productService = new ProductService(productRepo, imageStorage);
  const stockService = new StockService(productRepo, stockRepo);
  const challanService = new ChallanService(challanRepo, productRepo, stockRepo, customerRepo);
  const invoiceService = new InvoiceService(challanRepo, customerRepo);
  const dashboardService = new DashboardService(dashboardRepo);

  const authController = new AuthController(authService);
  const accessRequestController = new AccessRequestController(accessRequestService);
  const customerController = new CustomerController(customerService);
  const productController = new ProductController(productService, stockService);
  const stockController = new StockController(stockService);
  const challanController = new ChallanController(challanService, invoiceService);
  const dashboardController = new DashboardController(dashboardService);

  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = env.frontendUrl
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'OK' });
  });

  app.use('/auth', authRouter(authController, accessRequestController));
  app.use('/customers', customerRouter(customerController));
  app.use('/products', productRouter(productController));
  app.use('/stock', stockRouter(stockController));
  app.use('/challans', challanRouter(challanController));
  app.use('/dashboard', dashboardRouter(dashboardController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}