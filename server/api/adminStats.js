/**
 * SotMDE API — Admin statistics endpoints.
 * Phase 6, Step 6.5.
 *
 * All routes require admin role.
 *
 * GET /api/admin/stats/outcomes
 *   Aggregated outcomes: total games, win rates, average duration,
 *   most common hero combos. Supports filters:
 *     villainDeckId, heroDeckId, version, result, dateFrom, dateTo
 *
 * GET /api/admin/stats/games
 *   Paginated list of completed games with result, decks, duration,
 *   round count. Each row links to the event log.
 *   Query params: page (default 1), pageSize (default 20)
 *
 * GET /api/admin/stats/games/:gameId/events
 *   Full ordered event log for one game. Supports eventType filter.
 */

'use strict';

const passport = require('passport');
const { wrapAsync } = require('../util.js');
const { getDb } = require('../db.js');

function requireAdmin(req, res, next) {
    if (!req.user || !req.user.permissions?.isAdmin) {
        return res.status(403).send({ success: false, message: 'Admin role required' });
    }
    next();
}

function buildDateFilter(dateFrom, dateTo) {
    const filter = {};
    if (dateFrom) {
        const from = new Date(dateFrom);
        if (!isNaN(from.getTime())) filter.$gte = from;
    }
    if (dateTo) {
        const to = new Date(dateTo);
        if (!isNaN(to.getTime())) filter.$lte = to;
    }
    return Object.keys(filter).length > 0 ? filter : null;
}

module.exports.init = function (server) {
    // -------------------------------------------------------------------------
    // GET /api/admin/stats/outcomes
    // -------------------------------------------------------------------------
    server.get(
        '/api/admin/stats/outcomes',
        passport.authenticate('jwt', { session: false }),
        requireAdmin,
        wrapAsync(async function (req, res) {
            const db = getDb();
            const outcomes = db.get('gameOutcomes');

            const query = {};

            if (req.query.villainDeckId) {
                query.villainDeckId = req.query.villainDeckId;
            }
            if (req.query.result) {
                query.result = req.query.result;
            }
            if (req.query.version) {
                query.villainDeckVersion = req.query.version;
            }

            const dateFilter = buildDateFilter(req.query.dateFrom, req.query.dateTo);
            if (dateFilter) {
                query.endedAt = dateFilter;
            }

            // heroDecId filter — match any hero in the heroes array
            if (req.query.heroDeckId) {
                query['heroes.heroDeckId'] = req.query.heroDeckId;
            }

            const games = await outcomes.find(query, { sort: { endedAt: -1 } });

            if (games.length === 0) {
                return res.send({
                    totalGames: 0,
                    heroWins: 0,
                    villainWins: 0,
                    winRateByVillain: {},
                    winRateByHero: {},
                    avgDurationMinutes: null,
                    mostCommonHeroCombinations: []
                });
            }

            const totalGames = games.length;
            const heroWins = games.filter((g) => g.result === 'heroVictory').length;
            const villainWins = games.filter((g) => g.result === 'villainVictory').length;

            // Average duration
            const durationsWithData = games.filter((g) => typeof g.durationMinutes === 'number');
            const avgDurationMinutes =
                durationsWithData.length > 0
                    ? Math.round(
                          durationsWithData.reduce((sum, g) => sum + g.durationMinutes, 0) /
                              durationsWithData.length
                      )
                    : null;

            // Win rate by villain deck+version
            const villainBuckets = {};
            for (const g of games) {
                const key = `${g.villainDeckId}@${g.villainDeckVersion || 'unknown'}`;
                if (!villainBuckets[key])
                    villainBuckets[key] = {
                        wins: 0,
                        total: 0,
                        deckId: g.villainDeckId,
                        version: g.villainDeckVersion
                    };
                villainBuckets[key].total++;
                if (g.result === 'heroVictory') villainBuckets[key].wins++;
            }
            const winRateByVillain = {};
            for (const [key, b] of Object.entries(villainBuckets)) {
                winRateByVillain[key] = {
                    deckId: b.deckId,
                    version: b.version,
                    total: b.total,
                    heroWins: b.wins,
                    heroWinRate: b.total > 0 ? Math.round((b.wins / b.total) * 100) : 0
                };
            }

            // Win rate by hero deck+version
            const heroBuckets = {};
            for (const g of games) {
                for (const h of g.heroes || []) {
                    const key = `${h.heroDeckId}@${h.heroDeckVersion || 'unknown'}`;
                    if (!heroBuckets[key])
                        heroBuckets[key] = {
                            wins: 0,
                            total: 0,
                            deckId: h.heroDeckId,
                            version: h.heroDeckVersion
                        };
                    heroBuckets[key].total++;
                    if (g.result === 'heroVictory') heroBuckets[key].wins++;
                }
            }
            const winRateByHero = {};
            for (const [key, b] of Object.entries(heroBuckets)) {
                winRateByHero[key] = {
                    deckId: b.deckId,
                    version: b.version,
                    total: b.total,
                    wins: b.wins,
                    winRate: b.total > 0 ? Math.round((b.wins / b.total) * 100) : 0
                };
            }

            // Most common hero combinations (top 10)
            const comboCounts = {};
            for (const g of games) {
                const heroIds = (g.heroes || [])
                    .map((h) => h.heroDeckId)
                    .sort()
                    .join(',');
                if (heroIds) {
                    comboCounts[heroIds] = (comboCounts[heroIds] || 0) + 1;
                }
            }
            const mostCommonHeroCombinations = Object.entries(comboCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([combo, count]) => ({ combo: combo.split(','), count }));

            return res.send({
                totalGames,
                heroWins,
                villainWins,
                winRateByVillain,
                winRateByHero,
                avgDurationMinutes,
                mostCommonHeroCombinations
            });
        })
    );

    // -------------------------------------------------------------------------
    // GET /api/admin/stats/games
    // -------------------------------------------------------------------------
    server.get(
        '/api/admin/stats/games',
        passport.authenticate('jwt', { session: false }),
        requireAdmin,
        wrapAsync(async function (req, res) {
            const db = getDb();
            const outcomes = db.get('gameOutcomes');

            const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const skip = (page - 1) * pageSize;

            const query = {};
            const dateFilter = buildDateFilter(req.query.dateFrom, req.query.dateTo);
            if (dateFilter) {
                query.endedAt = dateFilter;
            }
            if (req.query.result) {
                query.result = req.query.result;
            }

            const [games, total] = await Promise.all([
                outcomes.find(query, {
                    sort: { endedAt: -1 },
                    skip,
                    limit: pageSize,
                    projection: {
                        gameId: 1,
                        result: 1,
                        villainDeckId: 1,
                        villainDeckVersion: 1,
                        environmentDeckId: 1,
                        environmentDeckVersion: 1,
                        heroes: 1,
                        durationMinutes: 1,
                        rounds: 1,
                        endedAt: 1,
                        startedAt: 1
                    }
                }),
                outcomes.count(query)
            ]);

            return res.send({
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                games: games.map((g) => ({
                    gameId: g.gameId,
                    result: g.result,
                    villain: { deckId: g.villainDeckId, version: g.villainDeckVersion },
                    environment: { deckId: g.environmentDeckId, version: g.environmentDeckVersion },
                    heroes: g.heroes || [],
                    durationMinutes: g.durationMinutes,
                    rounds: g.rounds,
                    startedAt: g.startedAt,
                    endedAt: g.endedAt,
                    eventLogUrl: `/api/admin/stats/games/${g.gameId}/events`
                }))
            });
        })
    );

    // -------------------------------------------------------------------------
    // GET /api/admin/stats/games/:gameId/events
    // -------------------------------------------------------------------------
    server.get(
        '/api/admin/stats/games/:gameId/events',
        passport.authenticate('jwt', { session: false }),
        requireAdmin,
        wrapAsync(async function (req, res) {
            const db = getDb();
            const events = db.get('gameEvents');

            const query = { gameId: req.params.gameId };

            if (req.query.eventType) {
                query.eventType = req.query.eventType;
            }

            const eventDocs = await events.find(query, {
                sort: { round: 1, timestamp: 1 }
            });

            return res.send({
                gameId: req.params.gameId,
                count: eventDocs.length,
                events: eventDocs
            });
        })
    );
};
