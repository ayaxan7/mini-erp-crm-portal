import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { DashboardController } from '../controllers/dashboard.controller.js';

export function dashboardRouter(dashboardController: DashboardController): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/summary', dashboardController.summary);
  return router;
}