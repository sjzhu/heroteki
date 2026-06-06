const account = require('./account');
const decks = require('./decks');
const games = require('./games');
const stats = require('./stats');
const cards = require('./cards');
const user = require('./user');
const league = require('./league');
const banlist = require('./banlist');

// SotMDE Phase 6 — new API routes
const sotmDecks = require('./sotmDecks');
const sotmCards = require('./sotmCards');
const adminCards = require('./adminCards');
const adminStats = require('./adminStats');

module.exports.init = function (server, options) {
    account.init(server, options);
    decks.init(server);
    games.init(server);
    stats.init(server);
    cards.init(server);
    user.init(server);
    banlist.init(server);
    league.init(server);

    // SotMDE routes — Phase 6
    sotmDecks.init(server);
    sotmCards.init(server);
    adminCards.init(server);
    adminStats.init(server);
};
