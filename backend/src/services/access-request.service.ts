import bcrypt from 'bcryptjs';
import { client } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTemporaryPassword, validatePassword } from '../utils/password.js';
import type { UserRepository } from '../repositories/user.repo.js';
import type { AccessRequestRepository, AccessRequestStatus } from '../repositories/access-request.repo.js';
import type { Role } from '../types/index.js';

export class AccessRequestService {
  constructor(
    private readonly accessRequestRepo: AccessRequestRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async requestAccess(input: { name: string; email: string; role: Role; message: string | null }) {
    const email = input.email.toLowerCase().trim();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw ApiError.conflict('An account already exists for this email — sign in instead');
    }
    const pending = await this.accessRequestRepo.findPendingByEmail(email);
    if (pending) {
      throw ApiError.conflict('You already have a pending access request');
    }
    return this.accessRequestRepo.create({ ...input, email });
  }

  async list(filters: { status?: AccessRequestStatus; offset: number; limit: number }) {
    return this.accessRequestRepo.list(filters);
  }

  async approve(id: number, initialPassword: string | null, reviewerId: number) {
    const db = await client();
    try {
      await db.query('BEGIN');
      const request = await this.accessRequestRepo.findById(id, db);
      if (!request) {
        throw ApiError.notFound('Access request not found');
      }
      if (request.status !== 'PENDING') {
        throw ApiError.conflict(`Access request is already ${request.status.toLowerCase()}`);
      }
      const existing = await this.userRepo.findByEmail(request.email, db);
      if (existing) {
        throw ApiError.conflict('A user already exists with this email — reject the request instead');
      }
      const supplied = initialPassword ? initialPassword.trim() : null;
      if (supplied) {
        const violation = validatePassword(supplied);
        if (violation) {
          throw ApiError.badRequest(violation);
        }
      }
      const password = supplied ?? generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await this.userRepo.create(
        { name: request.name, email: request.email, passwordHash, role: request.role },
        db,
      );
      await this.accessRequestRepo.updateStatus(id, 'APPROVED', reviewerId, db);
      await db.query('COMMIT');
      return {
        request: await this.accessRequestRepo.findById(id),
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        generatedPassword: supplied ? undefined : password,
      };
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  }

  async reject(id: number, reason: string | null, reviewerId: number) {
    const db = await client();
    try {
      await db.query('BEGIN');
      const request = await this.accessRequestRepo.findById(id, db);
      if (!request) {
        throw ApiError.notFound('Access request not found');
      }
      if (request.status !== 'PENDING') {
        throw ApiError.conflict(`Access request is already ${request.status.toLowerCase()}`);
      }
      await this.accessRequestRepo.updateStatus(id, 'REJECTED', reviewerId, db, reason);
      await db.query('COMMIT');
      return this.accessRequestRepo.findById(id);
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  }
}
