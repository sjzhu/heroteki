// Ashes alt-art lookup, used by the /useralts admin page (UserAltAdmin.jsx).
// The rest of the old /api/cards surface (card preload for deck-selection) was
// removed in docs/ashes-deck-selection-removal-plan.md Step 1; alt-art admin is
// explicitly out of scope for that plan, so this one route stays.
const ServiceFactory = require('../services/ServiceFactory');
const ConfigService = require('../services/ConfigService');

const cardService = ServiceFactory.cardService(new ConfigService());

module.exports.init = function (server) {
    server.get('/api/cards/alts', function (req, res, next) {
        cardService
            .getAltArts({ shortForm: true })
            .then((alts) => {
                res.send({ success: true, alts: alts });
            })
            .catch((err) => {
                return next(err);
            });
    });
};
