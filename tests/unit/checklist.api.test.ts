import {
  computeHasFailFromChecklistDocument,
  getChecklistItemsKey,
  patchChecklistItemById,
  isSubmitChecklistResponseSuccess,
  normalizePeakChecklistItemType,
  injectDriverNameIntoChecklistDocument,
  isPeakChecklistDriverNameTextItem,
  formatChecklistDateValue,
  formatChecklistTimeValue12h,
  applyChecklistDateTimeDefaults,
} from '@/api/checklist.api';

describe('checklist.api helpers', () => {
  it('normalizePeakChecklistItemType maps admin labels', () => {
    expect(normalizePeakChecklistItemType('Pass/Fail')).toBe('boolean');
    expect(normalizePeakChecklistItemType('Text')).toBe('string');
    expect(normalizePeakChecklistItemType('Vehicle Damage Image')).toBe('image');
    expect(normalizePeakChecklistItemType('Group Header')).toBe('group');
  });

  it('computeHasFailFromChecklistDocument treats Pass/Fail like boolean', () => {
    expect(
      computeHasFailFromChecklistDocument({
        items: [{ itemType: 'Pass/Fail', value: '1' }],
      }),
    ).toBe(1);
  });

  it('injectDriverNameIntoChecklistDocument sets value on driver name Text items', () => {
    const doc = {
      items: [
        { itemID: '1', itemType: 'Text', itemName: 'Driver Name', value: '' },
        { itemID: '2', itemType: 'Text', itemName: 'Notes', value: 'x' },
      ],
    };
    const out = injectDriverNameIntoChecklistDocument(doc, 'Jane Doe');
    expect((out.items as { value: string }[])[0].value).toBe('Jane Doe');
    expect((out.items as { value: string }[])[1].value).toBe('x');
  });

  it('isPeakChecklistDriverNameTextItem recognizes admin labels', () => {
    expect(isPeakChecklistDriverNameTextItem({ itemType: 'Text', itemName: 'Driver Name' })).toBe(true);
    expect(isPeakChecklistDriverNameTextItem({ itemType: 'Text', itemName: 'Operator Name' })).toBe(true);
    expect(isPeakChecklistDriverNameTextItem({ itemType: 'Pass/Fail', itemName: 'Driver Name' })).toBe(false);
  });

  it('computeHasFailFromChecklistDocument is 1 when any boolean value is "1"', () => {
    expect(
      computeHasFailFromChecklistDocument({
        items: [
          { itemType: 'boolean', value: '0' },
          { itemType: 'boolean', value: '1' },
        ],
      }),
    ).toBe(1);
    expect(
      computeHasFailFromChecklistDocument({
        items: [{ itemType: 'boolean', value: '0' }],
      }),
    ).toBe(0);
  });

  it('getChecklistItemsKey prefers items over checklist', () => {
    expect(getChecklistItemsKey({ items: [], checklist: [{ itemID: 'x' }] })).toBe('items');
    expect(getChecklistItemsKey({ checklist: [{ itemID: 'x' }] })).toBe('checklist');
  });

  it('patchChecklistItemById updates one row', () => {
    const doc = { items: [{ itemID: 'a', itemType: 'boolean', value: '' }] };
    const next = patchChecklistItemById(doc, 'a', (it) => {
      it.value = '0';
    });
    expect(next).not.toBe(doc);
    expect((next.items as { value: string }[])[0].value).toBe('0');
  });

  it('formatChecklistDateValue uses yyyy-MM-dd', () => {
    expect(formatChecklistDateValue(new Date(2026, 4, 20, 15, 30))).toBe('2026-05-20');
  });

  it('formatChecklistTimeValue12h uses 12-hour clock', () => {
    const s = formatChecklistTimeValue12h(new Date(2026, 4, 20, 14, 5));
    expect(s).toMatch(/PM|AM/);
    expect(s).toMatch(/02:05|2:05/);
  });

  it('applyChecklistDateTimeDefaults fills empty date and time only', () => {
    const at = new Date(2026, 0, 15, 9, 30);
    const doc = {
      items: [
        { itemID: '1', itemType: 'Date', value: '' },
        { itemID: '2', itemType: 'Time', value: '' },
        { itemID: '3', itemType: 'Date', value: '2025-12-01' },
      ],
    };
    const out = applyChecklistDateTimeDefaults(doc, at);
    const items = out.items as { itemID: string; value: string }[];
    expect(items[0].value).toBe('2026-01-15');
    expect(items[1].value).toMatch(/09:30|9:30/);
    expect(items[1].value).toMatch(/AM/);
    expect(items[2].value).toBe('2025-12-01');
  });

  it('isSubmitChecklistResponseSuccess', () => {
    expect(isSubmitChecklistResponseSuccess(null)).toBe(true);
    expect(isSubmitChecklistResponseSuccess({ success: true })).toBe(true);
    expect(isSubmitChecklistResponseSuccess({ success: false })).toBe(false);
  });
});
