import { Router } from 'express';
import type { DashboardController } from '../controllers/dashboard.controller.js';
import type { AuthMiddleware } from './types.js';

export function dashboardRouter(dashboardController: DashboardController, auth: AuthMiddleware): Router {
  const { requireAuth } = auth;
  const router = Router();
  router.use(requireAuth);
  router.get('/summary', dashboardController.summary);
  return router;
}