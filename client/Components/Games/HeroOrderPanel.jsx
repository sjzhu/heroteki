/**
 * SotMDE HeroOrderPanel.jsx — drag-and-drop hero turn order panel.
 * Shows all claimed heroes as draggable items; host can reorder and confirm.
 * Uses react-dnd useDrag/useDrop with a simple HERO item type.
 * Emits setheroorder { orderedDeckIds } when host clicks "Confirm Order".
 */
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { sendSocketMessage } from '../../redux/actions';

const ITEM_TYPE_HERO = 'sotm_hero';

/**
 * A single draggable hero row.
 * @param {{ deck: object, index: number, moveHero: function, isHost: boolean }} props
 */
const DraggableHeroRow = ({ deck, index, moveHero, isHost }) => {
    const ref = useRef(null);

    const [{ isDragging }, drag] = useDrag({
        type: ITEM_TYPE_HERO,
        item: { index },
        canDrag: isHost,
        collect: (monitor) => ({
            isDragging: monitor.isDragging()
        })
    });

    const [, drop] = useDrop({
        accept: ITEM_TYPE_HERO,
        hover(item) {
            if (!ref.current) return;
            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;
            moveHero(dragIndex, hoverIndex);
            item.index = hoverIndex;
        }
    });

    if (isHost) drag(drop(ref));

    return (
        <div
            ref={ref}
            style={{
                opacity: isDragging ? 0.4 : 1,
                padding: '6px 10px',
                marginBottom: '4px',
                background: '#2a2a2a',
                border: '1px solid #555',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isHost ? 'grab' : 'default',
                userSelect: 'none'
            }}
        >
            <span style={{ color: '#888', fontSize: '12px', minWidth: '20px' }}>
                {index + 1}.
            </span>
            <span style={{ flex: 1 }}>
                {deck.name}
                {deck.version && (
                    <span className='badge bg-secondary ms-2' style={{ fontSize: '0.7em' }}>
                        v{deck.version}
                    </span>
                )}
            </span>
            {isHost && (
                <span style={{ color: '#555', fontSize: '12px' }}>&#8597;</span>
            )}
        </div>
    );
};

/**
 * @param {{ currentGame: object, user: object }} props
 */
const HeroOrderPanel = ({ currentGame, user }) => {
    const dispatch = useDispatch();
    const heroSelection = currentGame?.heroSelection || {};
    const heroOrder = currentGame?.heroOrder || [];
    const isHost = currentGame?.owner === user?.username;
    const isConfirmed = heroOrder.length > 0;

    // Build a flat list of { deckId, playerName } from heroSelection
    const allSelectedDecks = Object.entries(heroSelection).flatMap(([playerName, deckIds]) =>
        deckIds.map((deckId) => ({ deckId, playerName }))
    );

    const [orderedDecks, setOrderedDecks] = useState([]);

    // Sync orderedDecks when heroSelection or heroOrder changes
    useEffect(() => {
        if (isConfirmed) {
            // Show confirmed order
            const ordered = heroOrder.map((slot) => {
                const entry = allSelectedDecks.find((d) => d.deckId === slot.heroId);
                return entry || { deckId: slot.heroId, playerName: slot.controllerPlayerId };
            });
            setOrderedDecks(ordered);
        } else {
            // Show selection order (unconfirmed)
            setOrderedDecks(allSelectedDecks);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [heroSelection, heroOrder, isConfirmed]);

    const moveHero = useCallback((dragIndex, hoverIndex) => {
        setOrderedDecks((prev) => {
            const updated = [...prev];
            const [moved] = updated.splice(dragIndex, 1);
            updated.splice(hoverIndex, 0, moved);
            return updated;
        });
    }, []);

    const confirmOrder = () => {
        const orderedDeckIds = orderedDecks.map((d) => d.deckId);
        dispatch(sendSocketMessage('setheroorder', { orderedDeckIds }));
    };

    if (allSelectedDecks.length === 0) {
        return null;
    }

    // Build name lookup from currentGame players (no dedicated deck-name endpoint needed here)
    const getDeckDisplayName = (deckId) => deckId;

    return (
        <div style={{ marginTop: '16px', padding: '12px', background: '#1a1a1a', borderRadius: '6px' }}>
            <h4 style={{ marginBottom: '8px' }}>
                Hero Turn Order
                {isConfirmed && (
                    <span className='badge bg-success ms-2' style={{ fontSize: '0.75em' }}>
                        Confirmed
                    </span>
                )}
            </h4>

            {isConfirmed ? (
                // Read-only numbered list
                <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    {orderedDecks.map((entry, i) => (
                        <li key={entry.deckId} style={{ padding: '4px 0', color: '#ccc' }}>
                            {getDeckDisplayName(entry.deckId)}{' '}
                            <span style={{ color: '#888', fontSize: '0.85em' }}>
                                ({entry.playerName})
                            </span>
                        </li>
                    ))}
                </ol>
            ) : (
                // Draggable list (host only draggable)
                <>
                    {isHost && (
                        <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
                            Drag to reorder, then confirm.
                        </div>
                    )}
                    {orderedDecks.map((entry, i) => (
                        <DraggableHeroRow
                            key={entry.deckId}
                            deck={{ id: entry.deckId, name: getDeckDisplayName(entry.deckId) }}
                            index={i}
                            moveHero={moveHero}
                            isHost={isHost}
                        />
                    ))}
                    {isHost && orderedDecks.length > 0 && (
                        <Button
                            variant='success'
                            size='sm'
                            className='mt-2'
                            onClick={confirmOrder}
                        >
                            Confirm Order
                        </Button>
                    )}
                </>
            )}
        </div>
    );
};

HeroOrderPanel.displayName = 'HeroOrderPanel';
export default HeroOrderPanel;
