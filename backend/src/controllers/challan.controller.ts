import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination } from '../types/index.js';
import type { ChallanService } from '../services/challan.service.js';
import type { IdParams } from '../validation/common.schema.js';
import type { ChallanListQuery, CreateChallanInput } from '../validation/challan.schema.js';

export class ChallanController {
  constructor(private readonly challanService: ChallanService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as ChallanListQuery;
    const pagination = parsePagination(req.query);
    const data = await this.challanService.list({
      ...pagination,
      status: query.status,
      customerId: query.customerId,
      search: query.search,
    });
    res.json({ success: true, data });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const data = await this.challanService.getById(id);
    res.json({ success: true, data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.validatedBody as CreateChallanInput;
    const data = await this.challanService.create(input, req.user!.id);
    res.status(201).json({ success: true, data });
  });

  confirm = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const data = await this.challanService.confirm(id, req.user!.id);
    res.json({ success: true, data });
  });

  cancel = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const data = await this.challanService.cancel(id, req.user!.id);
    res.json({ success: true, data });
  });
}