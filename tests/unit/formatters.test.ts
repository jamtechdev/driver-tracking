import { formatDate, formatCurrency, formatTime, formatRelativeTime } from '@/utils/formatters';

describe('formatters', () => {
  it('formatDate formats with default pattern', () => {
    const s = formatDate(new Date(2024, 0, 5));
    expect(s).toMatch(/01/);
    expect(s).toMatch(/2024/);
  });

  it('formatCurrency uses USD', () => {
    expect(formatCurrency(12.5)).toMatch(/12/);
    expect(formatCurrency(12.5)).toMatch(/\$/);
  });

  it('formatTime accepts string dates', () => {
    expect(formatTime('2024-06-01T15:30:00')).toMatch(/15/);
  });

  it('formatRelativeTime buckets roughly', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 30 * 1000);
    expect(formatRelativeTime(recent)).toBe('just now');
  });
});
