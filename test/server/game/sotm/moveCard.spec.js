/**
 * Unit tests for Game._genericMoveCard().
 *
 * Strategy: invoke the real prototype method with a minimal stubbed `this`
 * (like finaliseGame.spec.js, full Game instantiation needs a DB connection).
 * Regression coverage for the card-loss bug where moving to a non-existent
 * destination zone (e.g. villain/environment 'hand') removed the card from
 * the source zone without adding it anywhere.
 */

'use strict';

const Game = require('../../../../server/game/game.js');

describe('Game._genericMoveCard', () => {
    function makeCard(id) {
        return { id, name: id, zone: 'deck' };
    }

    function makeGameWith(controller) {
        return {
            _findCardInGame(cardId) {
                for (const zone of ['deck', 'trash', 'playArea', 'hand']) {
                    const arr = controller[zone];
                    if (Array.isArray(arr)) {
                        const card = arr.find((c) => c.id === cardId);
                        if (card) return { card, controller };
                    }
                }
                return { card: null, controller: null };
            },
            _findController() {
                return controller;
            },
            _genericMoveCard: Game.prototype._genericMoveCard
        };
    }

    it('moves a card between zones on the same controller', () => {
        const controller = { deck: [makeCard('c1'), makeCard('c2')], trash: [], playArea: [] };
        const game = makeGameWith(controller);

        game._genericMoveCard('c1', 'deck', 'playArea', 'villain-1');

        expect(controller.deck.map((c) => c.id)).toEqual(['c2']);
        expect(controller.playArea.map((c) => c.id)).toEqual(['c1']);
        expect(controller.playArea[0].zone).toBe('playArea');
    });

    it('does not remove the card from the source when the destination zone does not exist', () => {
        // Villain/environment controllers have no hand zone
        const controller = { deck: [makeCard('c1')], trash: [], playArea: [] };
        const game = makeGameWith(controller);

        game._genericMoveCard('c1', 'deck', 'hand', 'villain-1');

        expect(controller.deck.length).toBe(1);
        expect(controller.deck[0].id).toBe('c1');
    });

    it('does nothing when the card is not in the source zone', () => {
        const controller = { deck: [makeCard('c1')], trash: [], playArea: [] };
        const game = makeGameWith(controller);

        game._genericMoveCard('c1', 'trash', 'playArea', 'villain-1');

        expect(controller.deck.length).toBe(1);
        expect(controller.playArea.length).toBe(0);
    });

    it('moves a card to a different controller when controllerId names one (e.g. villain deck → hero hand)', () => {
        const villain = { deck: [makeCard('v1')], trash: [], playArea: [] };
        const hero = { deck: [], trash: [], playArea: [], hand: [] };
        const game = {
            _findCardInGame(cardId) {
                const card = villain.deck.find((c) => c.id === cardId);
                return card ? { card, controller: villain } : { card: null, controller: null };
            },
            _findController(controllerId) {
                return controllerId === 'hero-1' ? hero : null;
            },
            _genericMoveCard: Game.prototype._genericMoveCard
        };

        game._genericMoveCard('v1', 'deck', 'hand', 'hero-1');

        expect(villain.deck.length).toBe(0);
        expect(hero.hand.map((c) => c.id)).toEqual(['v1']);
        expect(hero.hand[0].zone).toBe('hand');
    });
});
