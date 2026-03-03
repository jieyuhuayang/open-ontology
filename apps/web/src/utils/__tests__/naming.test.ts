import { describe, it, expect } from 'vitest';
import { toKebabCase, toCamelCase } from '@/utils/naming';

describe('toKebabCase', () => {
  it('converts simple display name', () => {
    expect(toKebabCase('Aircraft id')).toBe('aircraft-id');
  });

  it('converts single word', () => {
    expect(toKebabCase('Name')).toBe('name');
  });

  it('strips leading/trailing separators', () => {
    expect(toKebabCase('  Hello World  ')).toBe('hello-world');
  });

  it('collapses multiple separators', () => {
    expect(toKebabCase('foo   bar___baz')).toBe('foo-bar-baz');
  });

  it('returns empty string for empty input', () => {
    expect(toKebabCase('')).toBe('');
  });
});

describe('toCamelCase', () => {
  it('converts simple display name', () => {
    expect(toCamelCase('Aircraft id')).toBe('aircraftId');
  });

  it('converts single word to lowercase', () => {
    expect(toCamelCase('Name')).toBe('name');
  });

  it('handles multiple words', () => {
    expect(toCamelCase('Date of manufacture')).toBe('dateOfManufacture');
  });

  it('handles special characters as separators', () => {
    expect(toCamelCase('foo_bar-baz')).toBe('fooBarBaz');
  });

  it('returns empty string for empty input', () => {
    expect(toCamelCase('')).toBe('');
  });
});
