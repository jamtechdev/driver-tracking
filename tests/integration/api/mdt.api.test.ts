import axios from 'axios';
import { reportMdtStatusAfterLogin } from '@/api/mdt.api';

describe('mdt.api', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reportMdtStatusAfterLogin GETs mdt update URL', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: { ok: true } } as never);
    const data = await reportMdtStatusAfterLogin({
      agencyID: '121',
      vehicleID: '1',
      driverID: '2',
      screenBrightness: 80,
    });
    expect(data).toEqual({ ok: true });
    expect(axios.get).toHaveBeenCalled();
    const url = (axios.get as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('controller=mdt');
  });
});
