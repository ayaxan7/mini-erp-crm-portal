import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination } from '../types/index.js';
import type { AccessRequestService } from '../services/access-request.service.js';
import type {
  AccessRequestListQuery,
  ApproveAccessInput,
  RejectAccessInput,
  RequestAccessInput,
} from '../validation/auth.schema.js';

export class AccessRequestController {
  constructor(private readonly accessRequestService: AccessRequestService) {}

  requestAccess = asyncHandler(async (req: Request, res: Response) => {
    const input = req.validatedBody as RequestAccessInput;
    const request = await this.accessRequestService.requestAccess(input);
    res.status(201).json({ success: true, data: request });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as AccessRequestListQuery | undefined;
    const { page, limit, offset } = parsePagination(req.query);
    const result = await this.accessRequestService.list({ status: query?.status, offset, limit });
    res.json({
      success: true,
      data: result.data,
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  });

  approve = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as { id: number };
    const body = req.validatedBody as ApproveAccessInput;
    const result = await this.accessRequestService.approve(id, body.initialPassword, req.user!.id);
    res.json({ success: true, data: result });
  });

  reject = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as { id: number };
    const body = req.validatedBody as RejectAccessInput;
    const request = await this.accessRequestService.reject(id, body.reason, req.user!.id);
    res.json({ success: true, data: request });
  });
}
