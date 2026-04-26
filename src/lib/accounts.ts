/**
 * ACCOUNT MANAGEMENT
 * ──────────────────
 * Single account (account switching removed)
 */

export type UserRole = "admin";

export interface Account {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/**
 * Single account for the Financial 101 Master crafted by Toy app
 */
export const MAIN_ACCOUNT: Account = {
  id: "toy",
  name: "Toy Theeranan",
  email: "toy.theeranan@gmail.com",
  role: "admin",
  createdAt: "2024-01-01T00:00:00Z",
};

/**
 * Get the current account (always returns main account)
 */
export function getCurrentAccount(): Account {
  return MAIN_ACCOUNT;
}

/**
 * Check if current account has required access level
 */
export function validateAccess(requiredRole: UserRole): boolean {
  return true; // Always admin
}
