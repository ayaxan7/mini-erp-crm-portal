import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination } from '../types/index.js';
import type { CustomerService } from '../services/customer.service.js';
import type { CustomerListQuery, CreateCustomerInput, CreateFollowupInput, UpdateCustomerInput, IdParams } from '../validation/customer.schema.js';

export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as CustomerListQuery;
    const pagination = parsePagination(req.query);
    const data = await this.customerService.list({
      ...pagination,
      search: query.search,
      type: query.type,
      status: query.status,
    });
    res.json({ success: true, data });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const data = await this.customerService.getById(id);
    res.json({ success: true, data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.validatedBody as CreateCustomerInput;
    const data = await this.customerService.create(input, req.user!.id);
    res.status(201).json({ success: true, data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const input = req.validatedBody as UpdateCustomerInput;
    const data = await this.customerService.update(id, input);
    res.json({ success: true, data });
  });

  addFollowup = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const input = req.validatedBody as CreateFollowupInput;
    const data = await this.customerService.addFollowup(id, input, req.user!.id);
    res.status(201).json({ success: true, data });
  });

  listFollowups = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const data = await this.customerService.listFollowups(id);
    res.json({ success: true, data });
  });
}