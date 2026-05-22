import axios from 'axios';
import { getVehiclesByDriver, assignVehicle, getAllVehicles } from '@/api/vehicle.api';
import {
  mdtUpdate,
  vehicleUpdate,
  speedMpsToMph,
  getAssignment,
  getRouteForDriver,
  selfUpdateAssignment,
  vehicles2Alert,
  selfUpdateDelete,
} from '@/api/position.api';
import { getChecklist, submitChecklist, getChecklistItemsArray } from '@/api/checklist.api';
import { getDriverData } from '@/api/driverData.api';
import { reportIncident } from '@/api/incident.api';
import { postPassengerEvent } from '@/api/passengerEvent.api';
import { getRouteSchedule } from '@/api/schedule.api';
import { sendDriverMessage } from '@/api/driverMessage.api';
import { passengerApi } from '@/api/passenger.api';

describe('axios-backed APIs', () => {
  beforeEach(() => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: {} } as never);
    jest.spyOn(axios, 'post').mockResolvedValue({ data: {} } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('vehicle.api', () => {
    it('getVehiclesByDriver parses array response', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: [{ vehicleID: 'v1', driverID: '1' }],
      });
      const list = await getVehiclesByDriver('1');
      expect(list).toHaveLength(1);
    });

    it('assignVehicle returns success', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      await expect(
        assignVehicle({ routeID: 'r', driverID: 'd', vehicleID: 'v', end: 1 }),
      ).resolves.toMatchObject({ success: true });
    });

    it('getAllVehicles returns empty on error', async () => {
      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('net'));
      await expect(getAllVehicles()).resolves.toEqual([]);
    });
  });

  describe('position.api', () => {
    it('mdtUpdate and vehicleUpdate call GET', async () => {
      await mdtUpdate({
        agencyID: 1,
        vehicleID: 2,
        driverID: 3,
        lat: 1,
        lng: 2,
        screenBrightness: 80,
      });
      await vehicleUpdate({
        agencyID: 1,
        vehicleID: 2,
        routeID: 3,
        driverID: 4,
        lat: 1,
        lng: 2,
      });
      expect(axios.get).toHaveBeenCalled();
    });

    it('speedMpsToMph converts', () => {
      expect(speedMpsToMph(1)).toBeCloseTo(2.23694, 4);
      expect(speedMpsToMph(null)).toBe(0);
    });

    it('getAssignment and getRouteForDriver', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      await getAssignment(1, 121);
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: { schedule: [] } });
      await getRouteForDriver(5, 121);
      expect(axios.get).toHaveBeenCalled();
    });

    it('self helpers', async () => {
      await selfUpdateAssignment({ agencyID: 1, vehicleID: 2, routeID: 3, driverID: 4 });
      await vehicles2Alert({ agencyID: 1, vehicleID: 2, alert: 1 });
      await selfUpdateDelete({ agencyID: 1, vehicleID: 2, driverID: 3 });
      expect((axios.get as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('checklist.api', () => {
    it('getChecklist returns document with items', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: { checklist: [{ itemID: '1', itemType: 'boolean' }] } });
      const r = await getChecklist('v1', '121');
      expect(getChecklistItemsArray(r.document).length).toBeGreaterThan(0);
    });

    it('submitChecklist posts full JSON document', async () => {
      (axios.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      const doc = { items: [{ itemID: '1', itemType: 'boolean', value: '0' }] };
      const r = await submitChecklist('v', 'd', '121', doc);
      expect(r.success).toBe(true);
      expect(axios.post).toHaveBeenCalled();
      const [, body] = (axios.post as jest.Mock).mock.calls[0];
      expect(body).toEqual(doc);
    });
  });

  describe('driverData.api', () => {
    it('getDriverData returns payload', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, vehicle: [] } });
      await expect(getDriverData()).resolves.toMatchObject({ success: true });
    });
  });

  describe('incident.api', () => {
    it('reportIncident handles success body', async () => {
      (axios.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });
      const r = await reportIncident({
        agencyID: '1',
        driverID: 'd',
        subject: 's',
        content: 'c',
        images: [],
      });
      expect(r.success).toBe(true);
    });
  });

  describe('passengerEvent.api', () => {
    it('postPassengerEvent GETs built URL', async () => {
      await postPassengerEvent({
        agencyID: '1',
        vehicleID: 'v',
        eventTimestamp: 1,
        eventCount: 2,
        lat: 0,
        lng: 0,
        course: 0,
        speed: 0,
        eventFare: 'Adult',
      });
      expect(axios.get).toHaveBeenCalled();
    });
  });

  describe('schedule.api', () => {
    it('getRouteSchedule', async () => {
      (axios.get as jest.Mock).mockResolvedValueOnce({ data: { schedule: [] } });
      await expect(getRouteSchedule('121', '5')).resolves.toEqual({ schedule: [] });
    });
  });

  describe('driverMessage.api', () => {
    it('sendDriverMessage', async () => {
      await sendDriverMessage({
        agencyID: 1,
        vehicleID: 2,
        driverID: 3,
        lat: 0,
        lng: 0,
        message: 'test',
      });
      expect(axios.get).toHaveBeenCalled();
    });
  });

  describe('passengerApi.updateCount', () => {
    it('uses axios.get', async () => {
      await passengerApi.updateCount({ agencyID: '1', vehicleID: 'v', count_in: 1 });
      expect(axios.get).toHaveBeenCalled();
    });
  });
});
