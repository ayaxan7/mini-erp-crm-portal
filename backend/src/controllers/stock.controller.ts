import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination } from '../types/index.js';
import type { StockService } from '../services/stock.service.js';
import type { StockMovementListQuery } from '../validation/challan.schema.js';

export class StockController {
  constructor(private readonly stockService: StockService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as StockMovementListQuery;
    const pagination = parsePagination(req.query);
    const data = await this.stockService.listAll({ ...pagination, productId: query.productId });
    res.json({ success: true, data });
  });
}