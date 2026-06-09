/**
 * Unit tests for SotMDE cardImageGenerator.
 * Tests shouldGeneratePlaceholder() and generatePlaceholder() (with mocked sharp).
 */

'use strict';

// Mock sharp before requiring the module under test
/* eslint-disable-next-line no-undef */
const mockToFile = jasmine.createSpy('toFile').and.returnValue(Promise.resolve());
const mockPng = jasmine.createSpy('png').and.returnValue({ toFile: mockToFile });
const mockSharp = jasmine.createSpy('sharp').and.returnValue({ png: mockPng });

// Mock the cardTemplates getTemplate function
const mockSvgGenerator = jasmine.createSpy('svgGenerator').and.returnValue('<svg>test</svg>');
const mockGetTemplate = jasmine.createSpy('getTemplate').and.returnValue(mockSvgGenerator);

// We need to mock the requires. Use jasmine's module caching approach.
// Since Jasmine doesn't have a built-in module mocker, we use require() with a
// temporary override via the module registry.

describe('cardImageGenerator', () => {
    let cardImageGenerator;
    // eslint-disable-next-line no-unused-vars
    let getTemplate;
    // eslint-disable-next-line no-unused-vars
    let sharp;

    beforeAll(() => {
        // Inject mocks into require cache before loading the module
        require.cache[require.resolve('sharp')] = {
            exports: mockSharp,
            id: require.resolve('sharp'),
            filename: require.resolve('sharp'),
            loaded: true
        };

        const cardTemplatesPath = require.resolve('../../../../server/game/sotm/cardTemplates');
        require.cache[cardTemplatesPath] = {
            exports: { getTemplate: mockGetTemplate },
            id: cardTemplatesPath,
            filename: cardTemplatesPath,
            loaded: true
        };

        // Clear the cardImageGenerator cache if already loaded
        const generatorPath = require.resolve('../../../../server/game/sotm/cardImageGenerator');
        delete require.cache[generatorPath];

        cardImageGenerator = require('../../../../server/game/sotm/cardImageGenerator');
    });

    afterAll(() => {
        // Clean up mocks from require cache
        delete require.cache[require.resolve('sharp')];
        const cardTemplatesPath = require.resolve('../../../../server/game/sotm/cardTemplates');
        delete require.cache[cardTemplatesPath];
        const generatorPath = require.resolve('../../../../server/game/sotm/cardImageGenerator');
        delete require.cache[generatorPath];
    });

    describe('shouldGeneratePlaceholder(card)', () => {
        it('returns true when imageUrl is null', () => {
            expect(cardImageGenerator.shouldGeneratePlaceholder({ imageUrl: null })).toBe(true);
        });

        it('returns true when imageUrl is undefined', () => {
            expect(cardImageGenerator.shouldGeneratePlaceholder({ imageUrl: undefined })).toBe(
                true
            );
        });

        it('returns true when imageUrl is empty string', () => {
            expect(cardImageGenerator.shouldGeneratePlaceholder({ imageUrl: '' })).toBe(true);
        });

        it('returns true when imageUrl starts with /card-images/placeholders/', () => {
            expect(
                cardImageGenerator.shouldGeneratePlaceholder({
                    imageUrl: '/card-images/placeholders/legacy-01.png'
                })
            ).toBe(true);
        });

        it('returns true for any placeholder path', () => {
            expect(
                cardImageGenerator.shouldGeneratePlaceholder({
                    imageUrl: '/card-images/placeholders/baron-blade-char.png'
                })
            ).toBe(true);
        });

        it('returns false when imageUrl is a real external URL', () => {
            expect(
                cardImageGenerator.shouldGeneratePlaceholder({
                    imageUrl: 'https://example.com/card.png'
                })
            ).toBe(false);
        });

        it('returns false when imageUrl is a non-placeholder local path', () => {
            expect(
                cardImageGenerator.shouldGeneratePlaceholder({
                    imageUrl: '/card-images/official/legacy-char.jpg'
                })
            ).toBe(false);
        });

        it('returns false when imageUrl is a manual upload path', () => {
            expect(
                cardImageGenerator.shouldGeneratePlaceholder({
                    imageUrl: '/card-images/manual/my-card.png'
                })
            ).toBe(false);
        });

        it('returns false when imageUrl is any non-empty non-placeholder string', () => {
            expect(
                cardImageGenerator.shouldGeneratePlaceholder({
                    imageUrl: '/some/other/path.png'
                })
            ).toBe(false);
        });
    });

    describe('generatePlaceholder(card)', () => {
        const testCard = {
            id: 'test-card-01',
            name: 'Test Card',
            type: 'heroCard',
            keywords: [],
            text: 'Test card text.',
            hp: null,
            imageUrl: null
        };

        beforeEach(() => {
            mockSharp.calls.reset();
            mockPng.calls.reset();
            mockToFile.calls.reset();
            mockGetTemplate.calls.reset();
            mockSvgGenerator.calls.reset();
            mockSvgGenerator.and.returnValue('<svg>test</svg>');
            mockGetTemplate.and.returnValue(mockSvgGenerator);
        });

        it('calls getTemplate(card) to get the template function', async () => {
            await cardImageGenerator.generatePlaceholder(testCard);
            expect(mockGetTemplate).toHaveBeenCalledWith(testCard);
        });

        it('calls the template function with the card to get SVG string', async () => {
            await cardImageGenerator.generatePlaceholder(testCard);
            expect(mockSvgGenerator).toHaveBeenCalledWith(testCard);
        });

        it('passes SVG string as Buffer to sharp', async () => {
            mockSvgGenerator.and.returnValue('<svg>my-svg</svg>');
            await cardImageGenerator.generatePlaceholder(testCard);
            expect(mockSharp).toHaveBeenCalled();
            const sharpArg = mockSharp.calls.mostRecent().args[0];
            expect(Buffer.isBuffer(sharpArg)).toBe(true);
        });

        it('calls .png() on the sharp instance', async () => {
            await cardImageGenerator.generatePlaceholder(testCard);
            expect(mockPng).toHaveBeenCalled();
        });

        it('calls .toFile() with a path containing the card id', async () => {
            await cardImageGenerator.generatePlaceholder(testCard);
            expect(mockToFile).toHaveBeenCalled();
            const filePath = mockToFile.calls.mostRecent().args[0];
            expect(filePath).toContain('test-card-01');
        });

        it('returns the public URL path for the card', async () => {
            const result = await cardImageGenerator.generatePlaceholder(testCard);
            expect(result).toBe('/card-images/placeholders/test-card-01.png');
        });

        it('returns a path with the card id as the filename', async () => {
            const card2 = { ...testCard, id: 'baron-blade-char' };
            const result = await cardImageGenerator.generatePlaceholder(card2);
            expect(result).toBe('/card-images/placeholders/baron-blade-char.png');
        });
    });
});
