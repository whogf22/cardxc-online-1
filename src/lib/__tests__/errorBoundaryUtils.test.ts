/**
 * Error Boundary Utilities Tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
  safeNumber,
  safeString,
  safeArray,
  safeObject,
  safeDate,
  safeExecute,
  safeExecuteAsync,
} from '../errorBoundaryUtils';

describe('Error Boundary Utilities', () => {
  describe('safeNumber', () => {
    it('returns the number for a valid number', () => {
      expect(safeNumber(42)).toBe(42);
    });

    it('returns 0 (default) for null', () => {
      expect(safeNumber(null)).toBe(0);
    });

    it('returns 0 (default) for undefined', () => {
      expect(safeNumber(undefined)).toBe(0);
    });

    it('returns custom default for null', () => {
      expect(safeNumber(null, -1)).toBe(-1);
    });

    it('returns 0 for NaN', () => {
      expect(safeNumber(NaN)).toBe(0);
    });

    it('returns 0 for Infinity', () => {
      expect(safeNumber(Infinity)).toBe(0);
    });

    it('parses numeric string', () => {
      expect(safeNumber('3.14')).toBe(3.14);
    });

    it('returns default for non-numeric string', () => {
      expect(safeNumber('abc', 5)).toBe(5);
    });

    it('handles 0 as a valid value (not treated as falsy)', () => {
      expect(safeNumber(0)).toBe(0);
    });
  });

  describe('safeString', () => {
    it('returns the string unchanged', () => {
      expect(safeString('hello')).toBe('hello');
    });

    it('returns empty string for null', () => {
      expect(safeString(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(safeString(undefined)).toBe('');
    });

    it('returns custom default for null', () => {
      expect(safeString(null, 'N/A')).toBe('N/A');
    });

    it('converts number to string', () => {
      expect(safeString(42)).toBe('42');
    });

    it('converts boolean to string', () => {
      expect(safeString(true)).toBe('true');
    });
  });

  describe('safeArray', () => {
    it('returns the array unchanged', () => {
      const arr = [1, 2, 3];
      expect(safeArray(arr)).toBe(arr);
    });

    it('returns empty array for null', () => {
      expect(safeArray(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(safeArray(undefined)).toEqual([]);
    });

    it('returns custom default for null', () => {
      const def = [0];
      expect(safeArray(null, def)).toBe(def);
    });

    it('returns default for non-array value', () => {
      expect(safeArray('not an array')).toEqual([]);
    });

    it('returns default for object', () => {
      expect(safeArray({ length: 0 })).toEqual([]);
    });
  });

  describe('safeObject', () => {
    it('returns the object unchanged', () => {
      const obj = { a: 1 };
      expect(safeObject(obj)).toBe(obj);
    });

    it('returns null for null', () => {
      expect(safeObject(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(safeObject(undefined)).toBeNull();
    });

    it('returns custom default for null', () => {
      const def = { fallback: true };
      expect(safeObject(null, def)).toBe(def);
    });

    it('returns default for string', () => {
      expect(safeObject('not an object')).toBeNull();
    });

    it('returns default for number', () => {
      expect(safeObject(42)).toBeNull();
    });
  });

  describe('safeDate', () => {
    it('returns a Date for a valid date string', () => {
      const result = safeDate('2024-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('returns a Date for a Date object', () => {
      const d = new Date('2024-06-01');
      const result = safeDate(d);
      expect(result).toBe(d);
    });

    it('returns null for null', () => {
      expect(safeDate(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(safeDate(undefined)).toBeNull();
    });

    it('returns null for invalid date string', () => {
      expect(safeDate('not-a-date')).toBeNull();
    });

    it('returns custom default for invalid value', () => {
      const fallback = new Date('2020-01-01');
      expect(safeDate(null, fallback)).toBe(fallback);
    });
  });

  describe('safeExecute', () => {
    it('returns function result when successful', () => {
      expect(safeExecute(() => 42, 0)).toBe(42);
    });

    it('returns default value when function throws', () => {
      expect(safeExecute(() => { throw new Error('oops'); }, -1)).toBe(-1);
    });

    it('calls errorHandler when provided and function throws', () => {
      const handler = vi.fn();
      safeExecute(() => { throw new Error('oops'); }, 0, handler);
      expect(handler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('does not call errorHandler when function succeeds', () => {
      const handler = vi.fn();
      safeExecute(() => 'ok', '', handler);
      expect(handler).not.toHaveBeenCalled();
    });

    it('wraps non-Error throws in Error before passing to handler', () => {
      const handler = vi.fn();
      safeExecute(() => { throw 'string error'; }, 0, handler);
      expect(handler).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('safeExecuteAsync', () => {
    it('returns resolved value when promise resolves', async () => {
      const result = await safeExecuteAsync(async () => 'hello', '');
      expect(result).toBe('hello');
    });

    it('returns default value when promise rejects', async () => {
      const result = await safeExecuteAsync(
        async () => { throw new Error('fail'); },
        'fallback'
      );
      expect(result).toBe('fallback');
    });

    it('calls errorHandler when promise rejects', async () => {
      const handler = vi.fn();
      await safeExecuteAsync(
        async () => { throw new Error('async fail'); },
        null,
        handler
      );
      expect(handler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('does not call errorHandler when promise resolves', async () => {
      const handler = vi.fn();
      await safeExecuteAsync(async () => 'ok', '', handler);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
