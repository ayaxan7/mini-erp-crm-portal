import bcrypt from 'bcryptjs';
import { ApiError } from '../utils/ApiError.js';
import type { UserRepository } from '../repositories/user.repo.js';

export class AuthService {
  constructor(private readonly userRepo: UserRepository) {}

  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    return user;
  }
}