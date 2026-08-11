import { ApiError } from '../utils/ApiError.js';
import type { ProductRepository } from '../repositories/product.repo.js';
import type { CreateProductInput, UpdateProductInput } from '../validation/product.schema.js';
import type { Pagination } from '../types/index.js';
import type { ImageStorage } from './storage.service.js';

export interface ImageUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class ProductService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly imageStorage?: ImageStorage,
  ) {}

  async list(filters: Pagination & { search?: string; category?: string; lowStock?: boolean }) {
    const { rows, total } = await this.productRepo.list({
      offset: filters.offset,
      limit: filters.limit,
      search: filters.search,
      category: filters.category,
      lowStock: filters.lowStock,
    });
    return {
      data: rows,
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async getById(id: number) {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    return product;
  }

  async create(input: CreateProductInput, createdBy: number) {
    const existing = await this.productRepo.findBySku(input.sku);
    if (existing) {
      throw ApiError.conflict(`A product already exists with SKU ${input.sku}`);
    }
    return this.productRepo.create(input, createdBy);
  }

  async update(id: number, input: UpdateProductInput) {
    if (input.sku) {
      const existing = await this.productRepo.findBySku(input.sku);
      if (existing && existing.id !== id) {
        throw ApiError.conflict(`A product already exists with SKU ${input.sku}`);
      }
    }
    const product = await this.productRepo.update(id, input);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    return product;
  }

  async setImage(id: number, file: ImageUpload) {
    if (!this.imageStorage) {
      throw new ApiError(503, 'Image storage is not configured on the server');
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw ApiError.badRequest('Only PNG, JPEG or WebP images are allowed');
    }
    if (file.buffer.length > 5 * 1024 * 1024) {
      throw ApiError.badRequest('Image must be 5 MB or smaller');
    }
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const key = `products/${id}-${Date.now()}.${ext}`;
    const url = await this.imageStorage.save(key, file.buffer, file.mimetype);
    const updated = await this.productRepo.setImage(id, url);
    return updated ?? product;
  }
}