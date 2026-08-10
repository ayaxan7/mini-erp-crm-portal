import { ApiError } from '../utils/ApiError.js';
import type { CustomerRepository } from '../repositories/customer.repo.js';
import type { CreateCustomerInput, CreateFollowupInput, UpdateCustomerInput } from '../validation/customer.schema.js';
import type { Pagination } from '../types/index.js';

export class CustomerService {
  constructor(private readonly customerRepo: CustomerRepository) {}

  async list(filters: Pagination & { search?: string; type?: string; status?: string }) {
    const { rows, total } = await this.customerRepo.list({
      offset: filters.offset,
      limit: filters.limit,
      search: filters.search,
      type: filters.type,
      status: filters.status,
    });
    return {
      data: rows,
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async getById(id: number) {
    const customer = await this.customerRepo.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }
    return customer;
  }

  async create(input: CreateCustomerInput, createdBy: number) {
    return this.customerRepo.create(input, createdBy);
  }

  async update(id: number, input: UpdateCustomerInput) {
    const customer = await this.customerRepo.update(id, input);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }
    return customer;
  }

  async addFollowup(customerId: number, input: CreateFollowupInput, createdBy: number) {
    const customer = await this.customerRepo.findById(customerId);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }
    const followup = await this.customerRepo.addFollowup(customerId, input.notes, input.followUpDate, createdBy);
    await this.customerRepo.update(customerId, { followUpDate: input.followUpDate ?? customer.follow_up_date });
    return followup;
  }

  async listFollowups(customerId: number) {
    const customer = await this.customerRepo.findById(customerId);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }
    return this.customerRepo.listFollowups(customerId);
  }
}