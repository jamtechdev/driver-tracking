/**
 * Authentication Type Definitions
 */

export interface User {
  id: string;
  name: string;
  role: 'driver' | 'supervisor';
  driverId?: string;
  email?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

