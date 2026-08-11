import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination } from '../types/index.js';
import type { ProductService } from '../services/product.service.js';
import type { StockService } from '../services/stock.service.js';
import type { IdParams } from '../validation/common.schema.js';
import type { ProductListQuery, CreateProductInput, UpdateProductInput, StockMovementInput } from '../validation/product.schema.js';

export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly stockService: StockService,
  ) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as ProductListQuery;
    const pagination = parsePagination(req.query);
    const data = await this.productService.list({
      ...pagination,
      search: query.search,
      category: query.category,
      lowStock: query.lowStock,
    });
    res.json({ success: true, data });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const data = await this.productService.getById(id);
    res.json({ success: true, data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.validatedBody as CreateProductInput;
    const data = await this.productService.create(input, req.user!.id);
    res.status(201).json({ success: true, data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const input = req.validatedBody as UpdateProductInput;
    const data = await this.productService.update(id, input);
    res.json({ success: true, data });
  });

  addStock = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const input = req.validatedBody as StockMovementInput;
    const data = await this.stockService.adjustStock(id, input, req.user!.id);
    res.json({ success: true, data });
  });

  movements = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const pagination = parsePagination(req.query);
    const data = await this.stockService.listByProduct(id, pagination);
    res.json({ success: true, data });
  });

  uploadImage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No image file provided' });
      return;
    }
    const data = await this.productService.setImage(id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    res.json({ success: true, data });
  });
}