/**
 * Input Validation Functions
 */

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate PIN format (4-6 digits)
 */
export const isValidPin = (pin: string): boolean => {
  const pinRegex = /^\d{4,6}$/;
  return pinRegex.test(pin);
};

/**
 * Validate driver ID format
 */
export const isValidDriverId = (driverId: string): boolean => {
  return driverId.length >= 3 && driverId.length <= 20;
};

/**
 * Validate passenger count
 */
export const isValidPassengerCount = (count: number): boolean => {
  return count >= 0 && count <= 999;
};

