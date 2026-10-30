import { describe, expect, it } from 'vitest';
import { formatAmount } from '../utils/format';
describe('financial decimal formatting', () => {
  it('retains units beyond IEEE-754 and tiny nonzero amounts', () => {
    expect(formatAmount('9007199254740993.000000000000000001')).toBe('9,007,199,254,740,993.000000000000000001');
    expect(formatAmount('1E-36')).toBe('0.' + '0'.repeat(35) + '1');
    expect(formatAmount('123.4500')).toBe('123.45');
    expect(formatAmount('1.23e3')).toBe('1,230');
    expect(formatAmount('-0.000001')).toBe('-0.000001');
  });
  it('distinguishes missing and invalid amounts from real zero', () => {
    for(const value of [null, undefined, '', 'NaN', {}, '1e999']) expect(formatAmount(value)).toBe('—');
    expect(formatAmount('0')).toBe('0');
    expect(formatAmount('-0.00')).toBe('0');
  });
});
