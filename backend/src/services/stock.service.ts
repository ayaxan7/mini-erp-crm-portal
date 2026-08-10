import { client } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import type { ProductRepository } from '../repositories/product.repo.js';
import type { StockRepository } from '../repositories/stock.repo.js';
import type { StockMovementInput } from '../validation/product.schema.js';
import type { Pagination } from '../types/index.js';

export class StockService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly stockRepo: StockRepository,
  ) {}

  async adjustStock(productId: number, input: StockMovementInput, createdBy: number) {
    const db = await client();
    try {
      await db.query('BEGIN');
      const [product] = await this.productRepo.lockByIds([productId], db);
      if (!product) {
        throw ApiError.notFound('Product not found');
      }
      if (input.type === 'OUT' && product.current_stock < input.quantity) {
        throw ApiError.conflict(
          `Insufficient stock for ${product.name}: available ${product.current_stock}, requested ${input.quantity}`,
        );
      }
      const quantityChanged = input.type === 'IN' ? input.quantity : -input.quantity;
      await this.productRepo.adjustStock(productId, quantityChanged, db);
      await this.stockRepo.insertMovement({ productId, quantityChanged, movementType: input.type, reason: input.reason, createdBy }, db);
      await db.query('COMMIT');
      return this.productRepo.findById(productId);
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  }

  async listByProduct(productId: number, filters: Pagination) {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    const { rows, total } = await this.stockRepo.listByProduct(productId, {
      offset: filters.offset,
      limit: filters.limit,
    });
    return { data: rows, meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
  }

  async listAll(filters: Pagination & { productId?: number }) {
    const { rows, total } = await this.stockRepo.listAll({ offset: filters.offset, limit: filters.limit, productId: filters.productId });
    return { data: rows, meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
  }
}