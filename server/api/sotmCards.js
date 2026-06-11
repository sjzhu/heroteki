/**
 * SotMDE API — Card library endpoint.
 * Phase 6, Step 6.2.
 *
 * GET /api/sotm/cards?deckId=xxx&source=official|manual|user
 */

'use strict';

const passport = require('passport');
const { wrapAsync } = require('../util.js');
const { getDb } = require('../db.js');

module.exports.init = function (server) {
    server.get(
        '/api/sotm/cards',
        passport.authenticate('jwt', { session: false }),
        wrapAsync(async function (req, res) {
            const db = getDb();
            const cardsCollection = db.get('sotmCards');

            const query = {};

            if (req.query.deckId) {
                query.deckId = req.query.deckId;
            }

            if (req.query.source) {
                query.source = req.query.source;
                // User-source cards: filter to requester's own unless admin
                if (req.query.source === 'user') {
                    if (!req.user.permissions?.isAdmin) {
                        const userId = (req.user.id || req.user._id).toString();
                        query.uploadedBy = userId;
                    }
                }
            }

            const cards = await cardsCollection.find(query, {
                sort: { name: 1 }
            });

            res.send(cards);
        })
    );
};
