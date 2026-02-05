import { describe, it, expect } from 'vitest';
import { escHtml } from './escHtml.js';

describe('escHtml', () => {
  it('escapes < and > to prevent tag injection', () => {
    expect(escHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes & to prevent entity injection', () => {
    expect(escHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes double quotes', () => {
    expect(escHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty string for null', () => {
    expect(escHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escHtml(undefined)).toBe('');
  });

  it('coerces numbers to string', () => {
    expect(escHtml(42)).toBe('42');
  });

  it('passes through safe strings unchanged', () => {
    expect(escHtml('hello world 123')).toBe('hello world 123');
  });

  it('handles combined attack payload', () => {
    expect(escHtml('<img src=x onerror="alert(\'xss\')">')).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;'
    );
  });
});
