import axios from 'axios';
import { getIncomingMessages } from '@/api/incomingMessages.api';

describe('incomingMessages.api', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns message array when wrapped', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: { message: [{ messageID: '1', message: 'hi' }] },
    } as never);
    const list = await getIncomingMessages('121', 'v1');
    expect(Array.isArray(list)).toBe(true);
    expect((list as { messageID: string }[])[0].messageID).toBe('1');
  });

  it('falls back to raw data when list shape missing', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: { foo: 1 } } as never);
    const list = await getIncomingMessages('121');
    expect(list).toEqual({ foo: 1 });
  });
});
