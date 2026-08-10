import bcrypt from 'bcryptjs';
import { ApiError } from '../utils/ApiError.js';
import * as userRepo from '../repositories/user.repo.js';

export async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email.toLowerCase().trim());
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  return user;
}