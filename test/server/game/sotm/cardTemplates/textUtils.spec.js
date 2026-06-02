/**
 * Unit tests for SotMDE SVG text utilities.
 * Tests escapeXml and wrapText edge cases.
 */

'use strict';

const { escapeXml, wrapText } = require('../../../../../server/game/sotm/cardTemplates/shared/textUtils');

describe('escapeXml', () => {
    it('escapes < character', () => {
        expect(escapeXml('a < b')).toBe('a &lt; b');
    });

    it('escapes > character', () => {
        expect(escapeXml('a > b')).toBe('a &gt; b');
    });

    it('escapes & character', () => {
        expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('escapes " character', () => {
        expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it("escapes ' character", () => {
        expect(escapeXml("it's")).toBe('it&apos;s');
    });

    it('escapes multiple special characters in one string', () => {
        expect(escapeXml('<script>alert("x")</script>')).toBe(
            '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
        );
    });

    it('returns empty string for null input', () => {
        expect(escapeXml(null)).toBe('');
    });

    it('returns empty string for undefined input', () => {
        expect(escapeXml(undefined)).toBe('');
    });

    it('leaves a string with no special characters unchanged', () => {
        expect(escapeXml('hello world')).toBe('hello world');
    });

    it('coerces non-string inputs to string', () => {
        expect(escapeXml(42)).toBe('42');
    });
});

describe('wrapText', () => {
    it('returns empty array for empty string', () => {
        expect(wrapText('', 30)).toEqual([]);
    });

    it('returns empty array for null input', () => {
        expect(wrapText(null, 30)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
        expect(wrapText(undefined, 30)).toEqual([]);
    });

    it('handles a very long word with no spaces (places on its own line)', () => {
        const longWord = 'supercalifragilisticexpialidocious';
        const result = wrapText(longWord, 10);
        expect(result).toEqual([longWord]);
    });

    it('wraps a simple sentence at maxCharsPerLine', () => {
        // "Hello world foo" — limit 11 chars
        // "Hello world" = 11 chars → fits
        // "foo" → new line
        const result = wrapText('Hello world foo', 11);
        expect(result).toEqual(['Hello world', 'foo']);
    });

    it('does not split in the middle of a word', () => {
        const result = wrapText('one two three', 7);
        // "one two" = 7 → fits; "three" → new line
        expect(result).toEqual(['one two', 'three']);
    });

    it('handles a single word within the limit', () => {
        expect(wrapText('hello', 30)).toEqual(['hello']);
    });

    it('preserves explicit newlines in text', () => {
        const result = wrapText('line one\nline two', 40);
        expect(result).toEqual(['line one', 'line two']);
    });

    it('handles text with only spaces gracefully', () => {
        // Spaces get filtered as empty words; each paragraph (from split \n) has no words
        const result = wrapText('   ', 30);
        expect(result).toEqual([]);
    });

    it('wraps multi-word text correctly across multiple lines', () => {
        // "The quick brown fox" with limit 10:
        // "The quick" = 9 → fits
        // "brown fox" = 9 → fits
        const result = wrapText('The quick brown fox', 10);
        expect(result).toEqual(['The quick', 'brown fox']);
    });
});
