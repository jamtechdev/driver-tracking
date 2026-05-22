import { COLORS } from '@/theme/colors';

describe('theme colors', () => {
  it('defines core palette keys', () => {
    expect(COLORS.background).toBeDefined();
    expect(COLORS.textPrimary).toBeDefined();
  });
});
