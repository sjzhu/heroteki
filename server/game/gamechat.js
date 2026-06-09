// SotMDE: Retained from Ashteki with Ashes-specific imports and command methods removed.
// Retains addMessage/messages list so the chat panel still works.

class GameChat {
    constructor(game) {
        this.messages = [];
        this.game = game;
        this.msgSeq = 0;
    }

    getChatAsText() {
        const textMessages = this.messages.map((m) => this.getMessageAsText(m.message));
        return textMessages.join('\n');
    }

    getMessageAsText(message) {
        const messageParts = [];
        // eslint-disable-next-line no-unused-vars
        for (const [key, fragment] of Object.entries(message)) {
            if (fragment === null || fragment === undefined) {
                continue;
            }
            if (fragment.message) {
                messageParts.push(this.getMessageAsText(fragment.message));
            } else if (fragment.link && fragment.label) {
                continue;
            } else if (fragment.argType === 'card') {
                const indexLabel = fragment.index > 0 ? ' (' + fragment.index + ')' : '';
                messageParts.push(fragment.name + indexLabel);
            } else if (fragment.name && fragment.argType === 'player') {
                continue;
            } else if (fragment.argType === 'nonAvatarPlayer') {
                messageParts.push(fragment.name);
            } else {
                let messageFragment = fragment.toString();
                messageParts.push(messageFragment);
            }
        }
        return messageParts.join('');
    }

    pushMessage(message, activePlayer) {
        this.msgSeq++;
        const msg = { mid: this.msgSeq, date: new Date(), message: message, type: message.type };
        if (activePlayer) {
            msg.activePlayer = activePlayer;
        }
        this.messages.push(msg);
    }

    addChatMessage(format, player, message) {
        let args = [
            {
                name: player.name,
                argType: 'player'
            },
            message
        ];
        let formattedMessage = this.formatMessage(format, args);
        this.pushMessage(formattedMessage);
    }

    getFormattedMessage(message) {
        let args = Array.from(arguments).slice(1);
        let argList = args.map((arg) => {
            if (arg && arg.name && arg.argType === 'player') {
                return {
                    name: arg.name,
                    argType: arg.argType
                };
            }
            return arg;
        });
        return this.formatMessage(message, argList);
    }

    addMessage(message, ...args) {
        let formattedMessage = this.getFormattedMessage(message, ...args);
        this.pushMessage(formattedMessage, this.game.activePlayer && this.game.activePlayer.name);
    }

    addAlert(type, message, ...args) {
        let formattedMessage = this.getFormattedMessage(message, ...args);
        const alertMsg = { alert: { type: type, message: formattedMessage } };
        this.pushMessage(alertMsg, this.game.activePlayer && this.game.activePlayer.name);
    }

    formatMessage(format, args) {
        if (!format || typeof format !== 'string') {
            return '';
        }

        let messageFragments = format.split(/(\{\d+\})/);
        let returnedFraments = [];

        for (const fragment of messageFragments) {
            let argMatch = fragment.match(/\{(\d+)\}/);
            if (argMatch) {
                let arg = args[argMatch[1]];
                if (arg || arg === 0) {
                    if (Array.isArray(arg)) {
                        returnedFraments.push(this.formatArray(arg));
                    } else {
                        returnedFraments.push(arg);
                    }
                }
                continue;
            }

            if (fragment) {
                returnedFraments.push(fragment);
            }
        }

        return returnedFraments;
    }

    formatArray(array) {
        if (array.length === 0) {
            return '';
        }

        let format = [...Array(array.length).keys()].map((i) => '{' + i + '}').join(',');
        return { message: this.formatMessage(format, array) };
    }
}

module.exports = GameChat;
