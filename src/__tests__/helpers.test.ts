import {
  PHONE_REGEX,
  BELIZE_BBOX,
  MAX_SEATS,
  MAX_PRICE_CENTS,
  MAX_DESCRIPTION_LENGTH,
} from '@/lib/constants';

describe('PHONE_REGEX', () => {
  it('accepts valid Belize phone numbers', () => {
    expect(PHONE_REGEX.test('+5016001234')).toBe(true);
    expect(PHONE_REGEX.test('+5012345678')).toBe(true);
  });

  it('rejects numbers without +501 prefix', () => {
    expect(PHONE_REGEX.test('5016001234')).toBe(false);
    expect(PHONE_REGEX.test('+16001234567')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(PHONE_REGEX.test('+501600123')).toBe(false);
    expect(PHONE_REGEX.test('+50160012345')).toBe(false);
  });

  it('rejects empty', () => {
    expect(PHONE_REGEX.test('')).toBe(false);
  });
});

describe('BELIZE_BBOX', () => {
  it('has correct bounding box values', () => {
    expect(BELIZE_BBOX.north).toBeGreaterThan(BELIZE_BBOX.south);
    expect(BELIZE_BBOX.east).toBeGreaterThan(BELIZE_BBOX.west);
  });

  it('contains Belmopan (capital)', () => {
    const lat = 17.251;
    const lng = -88.767;
    expect(lat).toBeGreaterThan(BELIZE_BBOX.south);
    expect(lat).toBeLessThan(BELIZE_BBOX.north);
    expect(lng).toBeGreaterThan(BELIZE_BBOX.west);
    expect(lng).toBeLessThan(BELIZE_BBOX.east);
  });
});

describe('constants', () => {
  it('MAX_SEATS is a reasonable value', () => {
    expect(MAX_SEATS).toBe(20);
  });

  it('MAX_PRICE_CENTS allows up to $9,999 BZD', () => {
    expect(MAX_PRICE_CENTS).toBe(999_900);
  });

  it('MAX_DESCRIPTION_LENGTH is 500', () => {
    expect(MAX_DESCRIPTION_LENGTH).toBe(500);
  });
});
