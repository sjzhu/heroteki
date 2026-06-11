// SotMDE SotmBoard component (Phase 5, Step 5.1).
// Top-level board component. Three-row layout: villain / environment / hero columns.
// Hero columns are horizontally scrollable for 1–5 heroes.
// Active hero column is highlighted with a coloured border.
// Wired into AppRoutes.jsx in Step 5.11.
//
// Reads Redux state via selectors from client/redux/selectors/game.js.
// Does NOT import any Ashteki dead-code components.

import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sendGameMessage, leaveGame } from '../../redux/actions';
import {
    selectVillain,
    selectEnvironment,
    selectHeroes,
    selectTurnState,
    selectIsGameOver,
    selectGameOverPrompt,
    selectCurrentGame
} from '../../redux/selectors/game';

import TurnTracker from './TurnTracker';
import VillainArea from './VillainArea';
import EnvironmentArea from './EnvironmentArea';
import HeroArea from './HeroArea';
import GameOverModal from './GameOverModal';
import PostGameSummary from './PostGameSummary';
import SotmGameChat from './SotmGameChat';

const SotmBoard = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Redux state via selectors
    const villain = useSelector(selectVillain);
    const environment = useSelector(selectEnvironment);
    const heroes = useSelector(selectHeroes);
    const turnState = useSelector(selectTurnState);
    const isGameOver = useSelector(selectIsGameOver);
    const gameOverPromptOpen = useSelector(selectGameOverPrompt);
    const currentGame = useSelector(selectCurrentGame);

    // Auth user — needed to know which heroes are "mine"
    const authUser = useSelector((state) => state.auth.user);
    const myPlayerId = authUser ? authUser.username : null;

    // Chat visibility
    const [showChat, setShowChat] = useState(true);

    // Determine which heroes "I" control
    const myHeroIds = new Set(
        heroes.filter((h) => h.controllerPlayerId === myPlayerId).map((h) => h.id)
    );

    // Determine active hero id from turn state
    const activeHeroId = turnState?.activeHeroId;

    // Hand destinations for deck-search "Move to Hand" (any card may be moved
    // to any hero's hand; villain/environment have no hand of their own)
    const heroHandTargets = heroes.map((h) => ({
        deckId: h.deckId,
        name: h.name || h.deckId
    }));

    // Determine if it's the villain's or environment's active turn
    const phase = turnState?.phase || 'setup';
    const isVillainTurn = phase.startsWith('villain_');
    const isEnvTurn = phase.startsWith('env_');

    // Generic action dispatcher — sends socket events to the server
    const handleAction = useCallback(
        (event, payload) => {
            dispatch(sendGameMessage(event, payload));
        },
        [dispatch]
    );

    const handleSendChat = useCallback(
        (text) => {
            dispatch(sendGameMessage('sendMessage', { text }));
        },
        [dispatch]
    );

    const handleReturnToLobby = useCallback(() => {
        if (currentGame) {
            dispatch(leaveGame(currentGame.gameId));
        }
        navigate('/');
    }, [dispatch, navigate, currentGame]);

    const handleEndGameModalOpen = useCallback(() => {
        // TurnTracker already emits initiateGameOver; modal opens via Redux gameOverPrompt
    }, []);

    if (!currentGame) {
        return <div style={loadingStyle}>Waiting for game state…</div>;
    }

    if (isGameOver) {
        return (
            <div style={boardStyle}>
                <TurnTracker
                    turnState={turnState}
                    myPlayerId={myPlayerId}
                    onEndGame={handleEndGameModalOpen}
                />
                <div style={mainAreaStyle}>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                        <PostGameSummary
                            currentGame={currentGame}
                            onReturnToLobby={handleReturnToLobby}
                        />
                    </div>
                    {showChat && (
                        <div style={chatPanelStyle}>
                            <SotmGameChat
                                messages={currentGame.chatLog || currentGame.messages || []}
                                onSendChat={handleSendChat}
                                muted={false}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={boardStyle}>
            {/* Fixed top bar */}
            <TurnTracker
                turnState={turnState}
                myPlayerId={myPlayerId}
                onEndGame={handleEndGameModalOpen}
            />

            {/* Main content area */}
            <div style={mainAreaStyle}>
                {/* Three-row board — wrapped for game-over overlay */}
                <div style={{ ...boardContentStyle, position: 'relative' }}>
                    {/* Phase 8.5.3d: non-interactive overlay when game is over */}
                    {isGameOver && <div style={gameOverOverlayStyle} aria-hidden='true' />}

                    {/* Row 1: Villain */}
                    <VillainArea
                        villain={villain}
                        isActiveTurn={isVillainTurn}
                        onAction={handleAction}
                        isGameOver={isGameOver}
                        allHeroes={heroHandTargets}
                    />

                    {/* Row 2: Environment */}
                    <EnvironmentArea
                        environment={environment}
                        isActiveTurn={isEnvTurn}
                        onAction={handleAction}
                        isGameOver={isGameOver}
                        allHeroes={heroHandTargets}
                    />

                    {/* Row 3: Hero columns (horizontally scrollable) */}
                    <div style={heroRowStyle}>
                        {heroes.map((hero) => {
                            const isMe = myHeroIds.has(hero.id);
                            const isActiveTurn = hero.id === activeHeroId;
                            return (
                                <HeroArea
                                    key={hero.id}
                                    hero={hero}
                                    isMe={isMe}
                                    isActiveTurn={isActiveTurn}
                                    onAction={handleAction}
                                    isGameOver={isGameOver}
                                    allHeroes={heroHandTargets}
                                />
                            );
                        })}
                        {heroes.length === 0 && (
                            <div style={{ color: '#6c757d', padding: '12px', fontSize: '0.85rem' }}>
                                No heroes in this game.
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat panel */}
                {showChat && (
                    <div style={chatPanelStyle}>
                        <SotmGameChat
                            messages={currentGame.chatLog || currentGame.messages || []}
                            onSendChat={handleSendChat}
                            muted={false}
                        />
                    </div>
                )}
            </div>

            {/* Game Over Modal — opens on all clients when gameOverPrompt received */}
            <GameOverModal
                show={gameOverPromptOpen}
                onClose={() => dispatch({ type: 'GAME_OVER_CANCELLED' })}
            />

            {/* Chat toggle button */}
            <button
                style={chatToggleStyle}
                onClick={() => setShowChat((v) => !v)}
                title={showChat ? 'Hide chat' : 'Show chat'}
            >
                {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>
        </div>
    );
};

// Styles
const boardStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0d1117',
    color: '#f8f9fa',
    overflow: 'hidden'
};

const mainAreaStyle = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
};

const boardContentStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: '8px',
    gap: '4px'
};

const heroRowStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    overflowX: 'auto',
    alignItems: 'flex-start',
    paddingBottom: '8px',
    minHeight: '200px'
};

const chatPanelStyle = {
    width: '280px',
    flexShrink: 0,
    borderLeft: '1px solid #343a40',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
};

const chatToggleStyle = {
    position: 'fixed',
    bottom: '8px',
    right: '8px',
    backgroundColor: '#343a40',
    border: '1px solid #495057',
    color: '#f8f9fa',
    borderRadius: '4px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    zIndex: 200
};

// Phase 8.5.3d: overlay that blocks pointer events on play areas when game is over
const gameOverOverlayStyle = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
    pointerEvents: 'all', // absorb all clicks/hovers so play areas become non-interactive
    cursor: 'not-allowed'
};

const loadingStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#6c757d',
    fontSize: '1rem',
    backgroundColor: '#0d1117'
};

SotmBoard.displayName = 'SotmBoard';

export default SotmBoard;
