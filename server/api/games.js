// SotMDE Phase 1: Replay system disabled. Replay endpoints return 404.
const passport = require('passport');

const GameService = require('../services/AshesGameService.js');
const ConfigService = require('../services/ConfigService.js');
const { wrapAsync } = require('../util.js');

const configService = new ConfigService();
const gameService = new GameService(configService);

module.exports.init = function (server) {
    server.get(
        '/api/games',
        passport.authenticate('jwt', { session: false }),
        wrapAsync(async function (req, res) {
            let games = await gameService.findByUserName(req.user.username, {
                months: req.query.months,
                gameType: req.query.gameType
            });
            res.send({ success: true, games: games });
        })
    );

    server.get(
        '/api/games/:tag',
        passport.authenticate('jwt', { session: false }),
        wrapAsync(async function (req, res) {
            let games = await gameService.getTaggedGames(req.params.tag, {
                months: req.query.months
            });
            res.send({ success: true, games: games });
        })
    );

    server.get(
        '/api/games/report/:tag',
        wrapAsync(async function (req, res) {
            let report = await gameService.getTagReport(req.params.tag, {
                months: req.query.months,
                pairings: req.query.pairings
            });
            res.send({ success: true, tag: req.params.tag, report: report });
        })
    );

    server.get(
        '/api/game/:id',
        wrapAsync(async function (req, res) {
            let game = await gameService.getGameById(req.params.id);
            res.send({ success: true, game: game });
        })
    );

    // Replay system disabled in Phase 1
    server.get('/api/game/:id/replay', (req, res) =>
        res.status(404).send({ success: false, message: 'Replay system not available' })
    );
};
