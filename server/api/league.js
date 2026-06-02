// SotMDE Phase 1: League system disabled. All routes return 404.
module.exports.init = function (server) {
    server.get('/api/league/:tag/pairings', (req, res) => res.status(404).send({ success: false, message: 'League system not available' }));
    server.get('/api/league/pairings', (req, res) => res.status(404).send({ success: false, message: 'League system not available' }));
};
