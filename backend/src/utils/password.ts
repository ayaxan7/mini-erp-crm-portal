import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
const SPECIAL = '!@#$%^&*';
const ALL = UPPER + LOWER + DIGIT + SPECIAL;

export interface PasswordRuleSummary {
  minLength: number;
  maxLength: number;
  requiresUpper: boolean;
  requiresLower: boolean;
  requiresNumber: boolean;
  requiresSpecial: boolean;
}

export const PASSWORD_RULES: PasswordRuleSummary = {
  minLength: 8,
  maxLength: 64,
  requiresUpper: true,
  requiresLower: true,
  requiresNumber: true,
  requiresSpecial: true,
};

export function describePasswordRules(): string {
  return 'At least 8 characters with a mix of upper and lower case letters, a number, and a special character.';
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters long`;
  }
  if (password.length > PASSWORD_RULES.maxLength) {
    return `Password must be at most ${PASSWORD_RULES.maxLength} characters long`;
  }
  if (PASSWORD_RULES.requiresUpper && !/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter';
  }
  if (PASSWORD_RULES.requiresLower && !/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter';
  }
  if (PASSWORD_RULES.requiresNumber && !/\d/.test(password)) {
    return 'Password must include a number';
  }
  if (PASSWORD_RULES.requiresSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a special character (e.g. !@#$%^&*)';
  }
  return null;
}

function pick(pool: string): string {
  return pool[randomInt(pool.length)];
}

export function generateTemporaryPassword(length = 10): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SPECIAL)];
  while (chars.length < length) {
    chars.push(pick(ALL));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
