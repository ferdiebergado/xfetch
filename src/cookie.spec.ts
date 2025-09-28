import { describe, expect, it } from 'vitest';
import { getCookie } from './cookie';

describe('cookie', () => {
  describe('getCookie', () => {
    it('returns the cookie when present', () => {
      document.cookie = 'sid=123';
      const cookie = getCookie('sid');
      expect(cookie).toBe('123');
    });

    it('returns empty string if cookie is missing', () => {
      document.cookie = 'other=123; foo=bar';
      const cookie = getCookie('sid');
      expect(cookie).toBe('');
    });

    it('returns the correct token when multiple cookies are present', () => {
      document.cookie = 'other=123; foo=bar; sid=abc';
      const cookie = getCookie('sid');
      expect(cookie).toBe('abc');
    });

    it('returns the correct token even if value contains an "="', () => {
      document.cookie = 'other=123; foo=bar; sid==';
      const cookie = getCookie('sid');
      expect(cookie).toBe('=');
    });

    it('returns an empty string for malformed cookie (no "=")', () => {
      document.cookie = 'sid; foo=bar';
      const cookie = getCookie('sid');
      expect(cookie).toBe('');
    });

    it('returns the first matching cookie if there are duplicates', () => {
      document.cookie = 'sid=123; foo=bar; sid=abc';
      const cookie = getCookie('sid');
      expect(cookie).toBe('123');
    });

    it('handles spaces in cookie values', () => {
      document.cookie = 'other=123; foo=bar; the_token=this is it';
      const cookie = getCookie('the_token');
      expect(cookie).toBe('this is it');
    });
  });
});
