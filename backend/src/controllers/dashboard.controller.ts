import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { DashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  summary = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.dashboardService.getSummary();
    res.json({ success: true, data });
  });
}