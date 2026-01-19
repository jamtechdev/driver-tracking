/**
 * Passenger & Fare Type Definitions
 */

export interface FareType {
  id: string;
  name: string;
  amount: number;
}

export interface PassengerTally {
  routeId: string;
  stopId: string;
  passengersOn: number;
  passengersOff: number;
  fareType: string;
  fareAmount: number;
  timestamp: string;
}

