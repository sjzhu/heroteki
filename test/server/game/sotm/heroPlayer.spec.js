/**
 * Unit tests for SotMDE HeroPlayer.
 * Tests drawCard, playCard, discardCard, getState.
 */

'use strict';

const HeroPlayer = require('../../../../server/game/sotm/HeroPlayer');
const SotmCard = require('../../../../server/game/sotm/SotmCard');

function makeCard(id, type, keywords, hp) {
    return new SotmCard({
        id,
        name: `Card ${id}`,
        type: type || 'heroCard',
        keywords: keywords || [],
        text: '',
        hp: hp || null,
        imageUrl: null
    });
}

function makeCharCard(id) {
    return makeCard(id, 'heroCharacter', [], 30);
}

function makeHero(numCards, charHp) {
    const charCard = makeCharCard('char-legacy');
    charCard.hp = charHp !== undefined ? charHp : 30;
    const cards = [];
    for (let i = 0; i < numCards; i++) {
        cards.push(makeCard(`card-${i}`, 'heroCard', [], null));
    }
    return new HeroPlayer('player1', 'Alice', 'legacy', cards, charCard);
}

describe('HeroPlayer', () => {
    describe('construction', () => {
        it('deck contains all non-character cards', () => {
            const hero = makeHero(5);
            expect(hero.deck.length).toBe(5);
        });

        it('hand, trash, playArea start empty', () => {
            const hero = makeHero(3);
            expect(hero.hand.length).toBe(0);
            expect(hero.trash.length).toBe(0);
            expect(hero.playArea.length).toBe(0);
        });

        it('characterCard is set', () => {
            const hero = makeHero(3);
            expect(hero.characterCard).toBeTruthy();
            expect(hero.characterCard.type).toBe('heroCharacter');
        });

        it('hp matches characterCard hp', () => {
            const hero = makeHero(3, 25);
            expect(hero.hp).toBe(25);
        });
    });

    describe('drawCard(n)', () => {
        it('moves n cards from deck to hand', () => {
            const hero = makeHero(10);
            hero.drawCard(4);
            expect(hero.hand.length).toBe(4);
            expect(hero.deck.length).toBe(6);
        });

        it('draws 1 card by default', () => {
            const hero = makeHero(5);
            hero.drawCard();
            expect(hero.hand.length).toBe(1);
            expect(hero.deck.length).toBe(4);
        });

        it('sets zone to "hand" on drawn cards', () => {
            const hero = makeHero(3);
            hero.drawCard(2);
            expect(hero.hand[0].zone).toBe('hand');
            expect(hero.hand[1].zone).toBe('hand');
        });

        it('does not draw more cards than exist in deck+trash', () => {
            const hero = makeHero(2);
            hero.drawCard(10); // only 2 cards exist
            expect(hero.hand.length).toBe(2);
        });

        it('auto-reshuffles trash into deck when deck is empty mid-draw', () => {
            const hero = makeHero(3);
            hero.shuffleDeck();
            // Draw all 3 into hand
            hero.drawCard(3);
            expect(hero.hand.length).toBe(3);
            expect(hero.deck.length).toBe(0);

            // Discard all from hand to trash (simulate them ending up in trash)
            // Move hand cards to trash manually
            for (const card of [...hero.hand]) {
                hero.hand.splice(hero.hand.indexOf(card), 1);
                card.zone = 'trash';
                hero.trash.push(card);
            }
            expect(hero.trash.length).toBe(3);
            expect(hero.hand.length).toBe(0);

            // Now draw 2 more — should trigger auto-reshuffle
            hero.drawCard(2);
            expect(hero.hand.length).toBe(2);
            expect(hero.trash.length).toBe(0);
            expect(hero.deck.length).toBe(1); // 3 reshuffled, 2 drawn → 1 remains
        });

        it('auto-reshuffle clears trash and repopulates deck', () => {
            const hero = makeHero(3);
            hero.drawCard(3);

            // Move all hand cards to trash
            for (const card of [...hero.hand]) {
                hero.hand.splice(hero.hand.indexOf(card), 1);
                card.zone = 'trash';
                hero.trash.push(card);
            }

            hero.drawCard(1);
            expect(hero.trash.length).toBe(0);
            expect(hero.hand.length).toBe(1);
        });

        it('calls logEvent callback for each drawn card', () => {
            const hero = makeHero(3);
            const events = [];
            hero.drawCard(2, (type, actorId, payload) => {
                events.push({ type, actorId, payload });
            });
            expect(events.length).toBe(2);
            expect(events[0].actorId).toBe('player1');
        });
    });

    describe('playCard(cardId)', () => {
        it('moves card from hand to playArea for normal cards', () => {
            const hero = makeHero(3);
            hero.drawCard(3);
            const cardId = hero.hand[0].id;

            const result = hero.playCard(cardId);
            expect(result).toBeTruthy();
            expect(hero.hand.length).toBe(2);
            expect(hero.playArea.length).toBe(1);
            expect(hero.playArea[0].id).toBe(cardId);
        });

        it('sets zone to "playArea" for normal card', () => {
            const hero = makeHero(3);
            hero.drawCard(1);
            const cardId = hero.hand[0].id;
            hero.playCard(cardId);
            expect(hero.playArea[0].zone).toBe('playArea');
        });

        it('moves one-shot cards directly to trash', () => {
            const charCard = makeCharCard('char-legacy');
            const oneShotCard = makeCard('shot-1', 'heroCard', ['one-shot'], null);
            const normalCard = makeCard('normal-1', 'heroCard', [], null);
            const hero = new HeroPlayer(
                'player1',
                'Alice',
                'legacy',
                [oneShotCard, normalCard],
                charCard
            );
            hero.shuffleDeck();
            // Put one-shot card in hand directly
            hero.deck.splice(hero.deck.indexOf(oneShotCard), 1);
            hero.hand.push(oneShotCard);
            oneShotCard.zone = 'hand';

            const result = hero.playCard('shot-1');
            expect(result).toBeTruthy();
            expect(hero.hand.length).toBe(0);
            expect(hero.playArea.length).toBe(0);
            expect(hero.trash.length).toBe(1);
            expect(hero.trash[0].id).toBe('shot-1');
        });

        it('sets zone to "trash" for one-shot card', () => {
            const charCard = makeCharCard('char-legacy');
            const oneShotCard = makeCard('shot-2', 'heroCard', ['one-shot'], null);
            const hero = new HeroPlayer('player1', 'Alice', 'legacy', [oneShotCard], charCard);
            hero.hand.push(oneShotCard);
            hero.deck.splice(hero.deck.indexOf(oneShotCard), 1);
            oneShotCard.zone = 'hand';

            hero.playCard('shot-2');
            expect(hero.trash[0].zone).toBe('trash');
        });

        it('returns null if card is not in hand', () => {
            const hero = makeHero(3);
            const result = hero.playCard('nonexistent-card');
            expect(result).toBeNull();
        });
    });

    describe('discardCard(cardId, fromZone)', () => {
        it('moves card from hand to trash', () => {
            const hero = makeHero(3);
            hero.drawCard(2);
            const cardId = hero.hand[0].id;

            const result = hero.discardCard(cardId, 'hand');
            expect(result).toBeTruthy();
            expect(hero.hand.length).toBe(1);
            expect(hero.trash.length).toBe(1);
            expect(hero.trash[0].id).toBe(cardId);
        });

        it('moves card from playArea to trash', () => {
            const hero = makeHero(3);
            hero.drawCard(2);
            const cardId = hero.hand[0].id;
            hero.playCard(cardId);
            expect(hero.playArea.length).toBe(1);

            hero.discardCard(cardId, 'playArea');
            expect(hero.playArea.length).toBe(0);
            expect(hero.trash.length).toBe(1);
        });

        it('calls card.clearPlayState() when discarding from playArea', () => {
            const hero = makeHero(3);
            hero.drawCard(1);
            const cardId = hero.hand[0].id;
            hero.playCard(cardId);
            const card = hero.playArea[0];

            // Add a token to simulate play-area state
            card.tokens['bounty'] = 3;
            expect(card.tokens['bounty']).toBe(3);

            hero.discardCard(cardId, 'playArea');
            // clearPlayState() should have cleared tokens
            expect(Object.keys(card.tokens).length).toBe(0);
        });

        it('does NOT call clearPlayState when discarding from hand', () => {
            const hero = makeHero(3);
            hero.drawCard(1);
            const card = hero.hand[0];
            card.tokens['test'] = 1;

            hero.discardCard(card.id, 'hand');
            // Token should still be there (hand discard doesn't clear play state)
            expect(card.tokens['test']).toBe(1);
        });

        it('returns null for unknown zone', () => {
            const hero = makeHero(3);
            hero.drawCard(1);
            const cardId = hero.hand[0].id;
            const result = hero.discardCard(cardId, 'unknownZone');
            expect(result).toBeNull();
        });

        it('returns null if card not found in zone', () => {
            const hero = makeHero(3);
            hero.drawCard(1);
            const result = hero.discardCard('nonexistent', 'hand');
            expect(result).toBeNull();
        });

        it('sets zone to "trash" after discard', () => {
            const hero = makeHero(3);
            hero.drawCard(1);
            const cardId = hero.hand[0].id;
            hero.discardCard(cardId, 'hand');
            expect(hero.trash[0].zone).toBe('trash');
        });
    });

    describe('getState(forPlayerId)', () => {
        let hero;

        beforeEach(() => {
            hero = makeHero(5);
            hero.drawCard(3);
        });

        it('returns full hand details for the owning player', () => {
            const state = hero.getState('player1');
            expect(Array.isArray(state.hand)).toBe(true);
            expect(state.hand.length).toBe(3);
            // Each hand entry should be a full card summary (has id, name, etc.)
            expect(state.hand[0].id).toBeDefined();
            expect(state.hand[0].name).toBeDefined();
            // Not a faceDown placeholder (faceDown placeholder only has the faceDown:true key)
            expect(state.hand[0].faceDown).not.toBe(true);
        });

        it('returns { faceDown: true } placeholders for other players', () => {
            const state = hero.getState('bob');
            expect(Array.isArray(state.hand)).toBe(true);
            expect(state.hand.length).toBe(3);
            expect(state.hand[0].faceDown).toBe(true);
            expect(state.hand[0].id).toBeUndefined();
        });

        it('handCount is always the actual count', () => {
            const stateOwner = hero.getState('player1');
            const stateOther = hero.getState('bob');
            expect(stateOwner.handCount).toBe(3);
            expect(stateOther.handCount).toBe(3);
        });

        it('includes deck, trash, and playArea in state', () => {
            const state = hero.getState('player1');
            expect(Array.isArray(state.deck)).toBe(true);
            expect(Array.isArray(state.trash)).toBe(true);
            expect(Array.isArray(state.playArea)).toBe(true);
        });

        it('includes characterCard in state', () => {
            const state = hero.getState('player1');
            expect(state.characterCard).toBeTruthy();
            expect(state.characterCard.type).toBe('heroCharacter');
        });

        it('includes isIncapacitated flag', () => {
            const state = hero.getState('player1');
            expect(state.isIncapacitated).toBe(false);
        });

        it('isIncapacitated is true after setHp to 0', () => {
            hero.setHp(0);
            const state = hero.getState('player1');
            expect(state.isIncapacitated).toBe(true);
        });

        it('returns controllerPlayerId in state', () => {
            const state = hero.getState('player1');
            expect(state.controllerPlayerId).toBe('player1');
        });
    });

    describe('HP management', () => {
        it('setHp() updates hp', () => {
            const hero = makeHero(3, 30);
            hero.setHp(15);
            expect(hero.hp).toBe(15);
        });

        it('setHp(0) sets isIncapacitated = true', () => {
            const hero = makeHero(3, 30);
            hero.setHp(0);
            expect(hero.isIncapacitated).toBe(true);
        });

        it('setHp negative sets isIncapacitated = true', () => {
            const hero = makeHero(3, 30);
            hero.setHp(-5);
            expect(hero.isIncapacitated).toBe(true);
        });

        it('adjustHp adds delta to current hp', () => {
            const hero = makeHero(3, 30);
            hero.adjustHp(-10);
            expect(hero.hp).toBe(20);
        });

        it('incapacitate() sets flag and clears character card tokens', () => {
            const hero = makeHero(3, 30);
            hero.characterCard.tokens['test'] = 5;
            hero.incapacitate();
            expect(hero.isIncapacitated).toBe(true);
            expect(Object.keys(hero.characterCard.tokens).length).toBe(0);
        });
    });
});
