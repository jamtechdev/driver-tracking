/**
 * Driver data for login selection
 */

export interface Driver {
  id: string;
  name: string;
  role: 'driver' | 'supervisor' | 'unassigned';
  requiresPin: boolean;
  pin?: string; // For demo - in production, verify against backend
}

export const DRIVERS: Driver[] = [
  { id: 'unassigned', name: 'Unassigned', role: 'unassigned', requiresPin: false },
  { id: '1', name: 'James T Kirk', role: 'driver', requiresPin: true, pin: '1234' },
  { id: '2', name: 'Jean-Luc Picard', role: 'driver', requiresPin: true, pin: '5678' },
  { id: '3', name: 'Katherine Janeway', role: 'driver', requiresPin: false },
  { id: 'supervisor', name: 'Supervisor', role: 'supervisor', requiresPin: true, pin: '9999' },
];
