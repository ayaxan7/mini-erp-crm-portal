import { client } from '../config/db.js';
import type { Queryable } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import type { ChallanRepository } from '../repositories/challan.repo.js';
import type { ProductRepository } from '../repositories/product.repo.js';
import type { StockRepository } from '../repositories/stock.repo.js';
import type { CustomerRepository } from '../repositories/customer.repo.js';
import type { CreateChallanInput } from '../validation/challan.schema.js';
import type { Pagination } from '../types/index.js';

export class ChallanService {
  constructor(
    private readonly challanRepo: ChallanRepository,
    private readonly productRepo: ProductRepository,
    private readonly stockRepo: StockRepository,
    private readonly customerRepo: CustomerRepository,
  ) {}

  async list(filters: Pagination & { status?: string; customerId?: number; search?: string }) {
    const { rows, total } = await this.challanRepo.list({
      offset: filters.offset,
      limit: filters.limit,
      status: filters.status,
      customerId: filters.customerId,
      search: filters.search,
    });
    return {
      data: rows,
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async getById(id: number) {
    const { challan, items } = await this.challanRepo.findById(id);
    if (!challan) {
      throw ApiError.notFound('Challan not found');
    }
    return { challan, items };
  }

  async create(input: CreateChallanInput, createdBy: number) {
    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await this.productRepo.findManyByIds(productIds);
    if (products.length !== productIds.length) {
      throw ApiError.notFound('One or more products not found');
    }

    const byId = new Map(products.map((product) => [product.id, product]));
    const snapshots = input.items.map((item) => {
      const product = byId.get(item.productId) as { name: string; sku: string; unit_price: string | number };
      return {
        productId: item.productId,
        productName: product.name,
        productSku: product.sku,
        unitPrice: Number(product.unit_price),
        quantity: item.quantity,
      };
    });

    const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);

    if (input.status === 'DRAFT') {
      return this.challanRepo.create(
        { customerId: input.customerId, totalQuantity, status: 'DRAFT', remarks: input.remarks },
        snapshots,
        createdBy,
      );
    }

    return this.confirmWithStockAdjustment(
      { customerId: input.customerId, totalQuantity, status: 'CONFIRMED', remarks: input.remarks },
      snapshots,
      createdBy,
    );
  }

  async confirm(id: number, createdBy: number) {
    const db = await client();
    try {
      await db.query('BEGIN');
      const challan = await this.challanRepo.findByIdWithLock(id, db);
      assertConfirmable(challan);
      const items = await this.challanRepo.findItems(id, db);
      await this.deduct(toLineItems(items), id, 'Sales Challan', createdBy, db);
      await this.challanRepo.updateStatus(id, 'CONFIRMED', db);
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
    return this.getById(id);
  }

  async cancel(id: number, createdBy: number) {
    const db = await client();
    try {
      await db.query('BEGIN');
      const challan = await this.challanRepo.findByIdWithLock(id, db);
      if (!challan) {
        throw ApiError.notFound('Challan not found');
      }
      if (challan.status === 'CANCELLED') {
        throw ApiError.conflict('Challan is already cancelled');
      }
      const items = await this.challanRepo.findItems(id, db);
      if (challan.status === 'CONFIRMED') {
        await this.restock(toLineItems(items), id, createdBy, db);
      }
      await this.challanRepo.updateStatus(id, 'CANCELLED', db);
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
    return this.getById(id);
  }

  private async confirmWithStockAdjustment(
    input: { customerId: number; totalQuantity: number; status: 'CONFIRMED'; remarks: string | null },
    snapshots: { productId: number; productName: string; productSku: string; unitPrice: number; quantity: number }[],
    createdBy: number,
  ) {
    const db = await client();
    try {
      await db.query('BEGIN');
      const challan = await this.challanRepo.create(input, snapshots, createdBy, db);
      await this.deduct(snapshots, challan.id, 'Sales Challan', createdBy, db);
      await db.query('COMMIT');
      return challan;
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  }

  private async deduct(
    items: { productId: number; quantity: number }[],
    challanId: number,
    reason: string,
    createdBy: number,
    db: Queryable,
  ) {
    const merged = mergeQuantities(items);
    const productIds = [...merged.keys()];
    const products = await this.productRepo.lockByIds(productIds, db);
    const available = new Map(products.map((product) => [product.id, product]));

    for (const [productId, quantity] of merged) {
      const product = available.get(productId);
      if (!product || product.current_stock < quantity) {
        throw ApiError.conflict(
          `Insufficient stock for ${product?.name ?? 'product'}: available ${product?.current_stock ?? 0}, requested ${quantity}`,
        );
      }
    }

    for (const [productId, quantity] of merged) {
      await this.productRepo.adjustStock(productId, -quantity, db);
      await this.stockRepo.insertMovement(
        {
          productId,
          quantityChanged: -quantity,
          movementType: 'OUT',
          reason,
          referenceType: 'CHALLAN',
          referenceId: challanId,
          createdBy,
        },
        db,
      );
    }
  }

  private async restock(items: { productId: number; quantity: number }[], challanId: number, createdBy: number, db: Queryable) {
    const merged = mergeQuantities(items);
    const products = await this.productRepo.lockByIds([...merged.keys()], db);
    if (products.length !== merged.size) {
      throw ApiError.conflict('Cannot cancel: one or more products in this challan no longer exist');
    }
    for (const [productId, quantity] of merged) {
      await this.productRepo.adjustStock(productId, quantity, db);
      await this.stockRepo.insertMovement(
        {
          productId,
          quantityChanged: quantity,
          movementType: 'IN',
          reason: 'Sales Challan Cancelled',
          referenceType: 'CHALLAN',
          referenceId: challanId,
          createdBy,
        },
        db,
      );
    }
  }
}

function assertConfirmable(challan: { id: number; status: string } | undefined): asserts challan is { id: number; status: 'DRAFT' } {
  if (!challan) {
    throw ApiError.notFound('Challan not found');
  }
  if (challan.status === 'CONFIRMED') {
    throw ApiError.conflict('Challan is already confirmed');
  }
  if (challan.status === 'CANCELLED') {
    throw ApiError.conflict('A cancelled challan cannot be confirmed');
  }
}

function mergeQuantities(items: { productId: number; quantity: number }[]): Map<number, number> {
  const merged = new Map<number, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  return merged;
}

function toLineItems(items: { product_id: number; quantity: number }[]): { productId: number; quantity: number }[] {
  return items.map((item) => ({ productId: item.product_id, quantity: item.quantity }));
}