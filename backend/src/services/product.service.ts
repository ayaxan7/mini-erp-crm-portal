import { ApiError } from '../utils/ApiError.js';
import type { ProductRepository } from '../repositories/product.repo.js';
import type { CreateProductInput, UpdateProductInput } from '../validation/product.schema.js';
import type { Pagination } from '../types/index.js';

export class ProductService {
  constructor(private readonly productRepo: ProductRepository) {}

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
}