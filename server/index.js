const LobbyServer = require('./lobbyserver.js');
const Lobby = require('./lobby.js');
const UserService = require('./services/AshesUserService');
const ConfigService = require('./services/ConfigService');
const configService = new ConfigService();
const express = require('express');
const http = require("http");
const logger = require('./log.js');
const basicAuth = require('express-basic-auth');
const config = require('config');

async function runServer() {
    const app = express();
    const httpServer = http.createServer(app);

    // Optional HTTP Basic Auth gate — enabled when config.privateMode is true.
    // NOTE: HTTPS is required for Basic Auth to be secure; credentials are
    // base64-encoded without TLS. This can alternatively be applied at the
    // reverse-proxy level (nginx/Caddy) to cover both lobby and game node.
    if (config.get('privateMode')) {
        app.use(basicAuth({
            users: { [config.get('privateUser')]: config.get('privatePassword') },
            challenge: true
        }));
    }

    let options = { configService: configService };
    options.userService = new UserService(options.configService);

    let lobbyServer = new LobbyServer(process.env.NODE_ENV !== 'production', app);
    lobbyServer.init(options);
    let lobby = new Lobby(httpServer, options);

    // pre-load card/deck data
    await lobby.init();

    let port = process.env.PORT || configService.getValueForSection('lobby', 'port') || 4000;

    httpServer.listen(port, () => {
        logger.info(`NODE_ENV=${process.env.NODE_ENV}`);
        logger.info(
            `==> ?? Listening on port ${port}. Open up http://localhost:${port}/ in your browser.`
        );
    });
}

module.exports = runServer;
