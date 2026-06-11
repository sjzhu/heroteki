/* global Promise */
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

describe('Game.moveCard play-state handling', () => {
    function makeTokenCard(id) {
        return {
            id,
            name: id,
            zone: 'playArea',
            tokens: { charge: 2 },
            clearPlayState() {
                this.tokens = {};
            }
        };
    }

    function makeGame(source, controllers) {
        return {
            _findCardInGame(cardId) {
                for (const zone of ['deck', 'trash', 'playArea', 'hand']) {
                    const arr = source[zone];
                    if (Array.isArray(arr)) {
                        const card = arr.find((c) => c.id === cardId);
                        if (card) return { card, controller: source };
                    }
                }
                return { card: null, controller: null };
            },
            _findController(controllerId) {
                return controllers[controllerId] || null;
            },
            _genericMoveCard: Game.prototype._genericMoveCard,
            _pushActionMessage() {},
            logEvent() {},
            saveState() {
                return Promise.resolve();
            },
            moveCard: Game.prototype.moveCard
        };
    }

    it('keeps tokens when moving between play areas', () => {
        const villain = { deck: [], trash: [], playArea: [makeTokenCard('c1')] };
        const hero = { deck: [], trash: [], playArea: [], hand: [] };
        const game = makeGame(villain, { 'hero-1': hero });

        game.moveCard('alice', {
            cardId: 'c1',
            fromZone: 'playArea',
            toZone: 'playArea',
            controllerId: 'hero-1'
        });

        expect(hero.playArea.length).toBe(1);
        expect(hero.playArea[0].tokens).toEqual({ charge: 2 });
    });

    it('clears tokens when leaving play (playArea → trash)', () => {
        const villain = { deck: [], trash: [], playArea: [makeTokenCard('c1')] };
        const game = makeGame(villain, { villain });

        game.moveCard('alice', {
            cardId: 'c1',
            fromZone: 'playArea',
            toZone: 'trash',
            controllerId: 'villain'
        });

        expect(villain.trash.length).toBe(1);
        expect(villain.trash[0].tokens).toEqual({});
    });
});

describe('Game.playCard with targetControllerId', () => {
    const HeroPlayer = require('../../../../server/game/sotm/HeroPlayer');

    function makeCard(id, keywords = []) {
        return { id, name: id, zone: 'hand', keywords };
    }

    function makeGame(hero, controllers) {
        return {
            _findActiveHeroForPlayer() {
                return hero;
            },
            _findController(controllerId) {
                return controllers[controllerId] || null;
            },
            _pushActionMessage() {},
            logEvent() {},
            saveState() {
                return Promise.resolve();
            },
            playCard: Game.prototype.playCard
        };
    }

    function makeHero(cards) {
        return {
            deckId: 'hero-1',
            hand: cards,
            playArea: [],
            trash: [],
            playCard: HeroPlayer.prototype.playCard
        };
    }

    it("plays into another controller's play area when targetControllerId is given", () => {
        const hero = makeHero([makeCard('c1')]);
        const env = { playArea: [], deck: [], trash: [] };
        const game = makeGame(hero, { environment: env });

        game.playCard('alice', { cardId: 'c1', targetControllerId: 'environment' });

        expect(hero.playArea.length).toBe(0);
        expect(env.playArea.map((c) => c.id)).toEqual(['c1']);
    });

    it('one-shots play to the play area like any other card (manual trash after resolution)', () => {
        const hero = makeHero([makeCard('c1', ['one-shot'])]);
        const env = { playArea: [], deck: [], trash: [] };
        const game = makeGame(hero, { environment: env });

        game.playCard('alice', { cardId: 'c1', targetControllerId: 'environment' });

        expect(hero.trash.length).toBe(0);
        expect(env.playArea.map((c) => c.id)).toEqual(['c1']);
    });

    it('plays to own play area when no target is given', () => {
        const hero = makeHero([makeCard('c1')]);
        const game = makeGame(hero, {});

        game.playCard('alice', { cardId: 'c1' });

        expect(hero.playArea.map((c) => c.id)).toEqual(['c1']);
    });
});
