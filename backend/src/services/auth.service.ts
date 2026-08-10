import { ApiError } from '../utils/ApiError.js';
import type { UserRepository } from '../repositories/user.repo.js';
import type { AuthTokenVerifier } from './firebaseVerifier.js';
import type { Role } from '../types/index.js';
import type { UserRow } from '../types/db.js';

export const DEFAULT_ROLE: Role = 'ACCOUNTS';

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly verifier: AuthTokenVerifier,
  ) {}

  async authenticate(token: string): Promise<UserRow> {
    const identity = await this.verifier.verifyToken(token);
    if (!identity) {
      throw ApiError.unauthorized('Invalid or expired token');
    }
    const existing = await this.userRepo.findByFirebaseUid(identity.uid);
    if (existing) {
      return existing;
    }
    const isFirstUser = (await this.userRepo.count()) === 0;
    return this.userRepo.create({
      firebaseUid: identity.uid,
      name: identity.name ?? identity.email?.split('@')[0] ?? 'New user',
      email: identity.email ?? '',
      role: isFirstUser ? 'ADMIN' : DEFAULT_ROLE,
    });
  }

  async findById(id: number): Promise<UserRow | undefined> {
    return this.userRepo.findById(id);
  }

  async list(params: { page: number; limit: number; search?: string }) {
    const { rows, total } = await this.userRepo.list({
      offset: (params.page - 1) * params.limit,
      limit: params.limit,
      search: params.search,
    });
    return { data: rows, meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) } };
  }

  async setRole(id: number, role: Role, changingOwnId: boolean): Promise<UserRow> {
    if (changingOwnId) {
      throw ApiError.conflict('You cannot change your own role');
    }
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    const updated = await this.userRepo.updateRole(id, role);
    if (!updated) {
      throw ApiError.notFound('User not found');
    }
    return updated;
  }
}