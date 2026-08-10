import type { DashboardRepository } from '../repositories/dashboard.repo.js';

export class DashboardService {
  constructor(private readonly dashboardRepo: DashboardRepository) {}

  getSummary() {
    return this.dashboardRepo.getSummary();
  }
}