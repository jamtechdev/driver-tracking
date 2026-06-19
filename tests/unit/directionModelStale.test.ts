import { DirectionModel, STALE_SCHEDULE_SECONDS } from '@/features/adherence';

describe('DirectionModel stale schedule', () => {
  it('STALE_SCHEDULE_SECONDS matches iOS 30 minutes', () => {
    expect(STALE_SCHEDULE_SECONDS).toBe(1800);
  });

  it('isStale after 30 minutes since setSchedule', () => {
    const model = new DirectionModel();
    model.setSchedule('1', [10, 10], 3600, [
      {
        blockID: '1',
        calculatedArrivalTime: 40000,
        departureTime: 0,
        link: 1,
        unscheduled: 0,
        longName: 'Stop',
        tripID: 1,
      },
    ]);

    const now = Date.now() / 1000;
    (model as unknown as { lastAdherenceUpdate: number }).lastAdherenceUpdate =
      now - STALE_SCHEDULE_SECONDS - 1;

    expect(model.isStale()).toBe(true);
  });
});
