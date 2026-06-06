import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Form } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import $ from 'jquery';

import Messages from '../GameBoard/Messages';
import { startGame, leaveGame, sendSocketMessage } from '../../redux/actions';
import PendingGamePlayers from './PendingGamePlayers';
import HeroOrderPanel from './HeroOrderPanel';
import ChargeMp3 from '../../assets/sound/charge.mp3';
import ChargeOgg from '../../assets/sound/charge.ogg';
import { getGameTypeLabel } from '../../util';

import './PendingGame.scss';
import { useEffect } from 'react';
import PictureButton from '../Lobby/PictureButton';
import { toastr } from 'react-redux-toastr';

function showNotification(notification) {
    if (window.Notification && Notification.permission === 'granted') {
        try {
            let windowNotification = new Notification('Ashes Reborn Online', notification);

            setTimeout(() => windowNotification.close(), 5000);
        } catch (error) {
            // console.warn('Error calling new Notification()');
            return false;
        }
    }
}

const PendingGame = () => {
    const currentGame = useSelector((state) => state.lobby.currentGame);
    const user = useSelector((state) => state.account.user);
    const { connecting, gameError, gameHost } = useSelector((state) => ({
        connecting: state.games.connecting,
        gameError: state.games.gameError,
        gameHost: state.games.gameHost
    }));
    // const newGameType = useSelector((state) => state.lobby.newGameType);
    const notification = useRef();
    const [waiting, setWaiting] = useState(false);
    const [message, setMessage] = useState('');
    const [canScroll, setCanScroll] = useState(true);
    const [playerCount, setPlayerCount] = useState(0);
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const messageRef = useRef(null);

    useEffect(() => {
        if (!user) {
            return;
        }

        let players = Object.values(currentGame.players).length;

        if (
            notification.current &&
            playerCount === 1 &&
            players === 2 &&
            currentGame.owner === user.username
        ) {
            let promise = notification.current?.play();

            if (promise !== undefined) {
                promise.catch(() => { }).then(() => { });
            }

            let otherPlayer = Object.values(currentGame.players).find(
                (p) => p.name !== user.username
            );

            showNotification({
                body: `${otherPlayer.name} has joined your game`,
                icon: `/img/avatar/${otherPlayer.username}.png`
            });
        }

        setPlayerCount(players);

        if (canScroll && messageRef.current) {
            $(messageRef.current)?.scrollTop(999999);
        }

        if (connecting) {
            setWaiting(false);
        }
    }, [
        currentGame.owner,
        currentGame.players,
        user,
        playerCount,
        currentGame,
        canScroll,
        connecting
    ]);

    if (!currentGame) {
        return null;
    }

    // SotMDE readiness: all players have heroes, villain+env set, heroOrder confirmed
    const allHeroesReady = () => {
        const players = Object.values(currentGame.players);
        if (players.length === 0) return false;
        const heroSelection = currentGame.heroSelection || {};
        const heroOrder = currentGame.heroOrder || [];
        const allPlayersHaveHeroes = players.every(
            (p) => heroSelection[p.name] && heroSelection[p.name].length > 0
        );
        return (
            allPlayersHaveHeroes &&
            !!currentGame.villainDeckId &&
            !!currentGame.environmentDeckId &&
            heroOrder.length > 0
        );
    };

    const canClickStart = () => {
        if (!user || !currentGame || currentGame.owner !== user.username || connecting) {
            return false;
        }

        if (!allHeroesReady()) {
            return false;
        }

        if (waiting && !gameError) {
            return false;
        }

        return true;
    };

    const getGameStatus = () => {
        if (gameError) {
            return t(gameError);
        }

        if (connecting) {
            return t('Connecting to game server {{host}}', { host: gameHost });
        }

        if (waiting) {
            return t('Waiting for lobby server...');
        }

        const heroSelection = currentGame.heroSelection || {};
        const heroOrder = currentGame.heroOrder || [];
        const players = Object.values(currentGame.players);

        const missingHeroes = players.filter(
            (p) => !heroSelection[p.name] || heroSelection[p.name].length === 0
        );
        if (missingHeroes.length > 0) {
            return t('Waiting for players to select heroes...');
        }

        if (!currentGame.villainDeckId || !currentGame.environmentDeckId) {
            return t('Villain and environment must be set (check game creation)');
        }

        if (heroOrder.length === 0) {
            return t('Host must confirm hero turn order');
        }

        if (currentGame.owner === user.username) {
            return t('Ready to begin, click Start');
        }

        return t('Ready to begin, waiting for host to start the game');
    };

    const sendMessage = () => {
        if (message === '') {
            return;
        }

        dispatch(sendSocketMessage('chat', message));

        setMessage('');
    };

    const copyGameLink = () => {
        const gameLink = `${window.location.protocol}//${window.location.host}/play?gameId=${currentGame.id}`;

        navigator.clipboard
            .writeText(gameLink)
            .then(() => toastr.success('Copied game link to clipboard'))
            .catch(() => toastr.error('Could not copy game link to clipboard'))

    };

    return (
        <>
            <audio ref={notification}>
                <source src={ChargeMp3} type='audio/mpeg' />
                <source src={ChargeOgg} type='audio/ogg' />
            </audio>
            <div className='newgame-header'>
                <PictureButton
                    text={getGameTypeLabel(currentGame.newGameType)}
                    // header='Premium'
                    disabled={true}
                    imageClass={currentGame.newGameType}
                />
                <div className='pending-header-content'>
                    <div className='start-game-buttons'>
                        <Button
                            variant='primary'
                            className='def'
                            onClick={() => {
                                dispatch(leaveGame(currentGame.id));
                            }}
                        >
                            Leave
                        </Button>
                        <Button
                            variant='success'
                            className='def'
                            disabled={!canClickStart()}
                            onClick={() => {
                                setWaiting(true);
                                dispatch(startGame(currentGame.id));
                            }}
                        >
                            Start
                        </Button>
                    </div>

                </div>
            </div>
            <div className='game-status'>{getGameStatus()}</div>
            <div className='copy-game-link'>
                <Button variant='primary' className='def' onClick={copyGameLink}>
                    Copy Game Link
                </Button>
            </div>

            {/* SotMDE game details sidebar */}
            {currentGame.villainDeckId && (
                <h4>
                    Villain:{' '}
                    <span className='unbold'>
                        {currentGame.villainDeckId}
                    </span>
                </h4>
            )}
            {currentGame.environmentDeckId && (
                <h4>
                    Environment:{' '}
                    <span className='unbold'>
                        {currentGame.environmentDeckId}
                    </span>
                </h4>
            )}

            <PendingGamePlayers currentGame={currentGame} user={user} />
            <HeroOrderPanel currentGame={currentGame} user={user} />

            <h3>Spectators ({currentGame.spectators.length})</h3>
            <div className='spectator-list'>
                {currentGame.spectators.map((spectator) => {
                    return <div key={spectator.name}>{spectator.name}</div>;
                })}
            </div>
            <div>
                <div
                    className='message-list'
                    ref={messageRef}
                    onScroll={() => {
                        setTimeout(() => {
                            if (
                                messageRef.current?.scrollTop >=
                                messageRef.current.scrollHeight -
                                messageRef.current.offsetHeight -
                                20
                            ) {
                                setCanScroll(true);
                            } else {
                                setCanScroll(false);
                            }
                        }, 500);
                    }}
                >
                    <Messages messages={currentGame.messages} />
                </div>
                <Form>
                    <Form.Group>
                        <Form.Control
                            type='text'
                            placeholder={t('Enter a message...')}
                            value={message}
                            onKeyPress={(event) => {
                                if (event.key === 'Enter') {
                                    sendMessage();
                                    event.preventDefault();
                                }
                            }}
                            onChange={(event) => setMessage(event.target.value)}
                        ></Form.Control>
                    </Form.Group>
                </Form>
            </div>
        </>
    );
};

PendingGame.displayName = 'PendingGame';

export default PendingGame;
