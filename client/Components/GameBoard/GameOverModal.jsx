// SotMDE GameOverModal component (Phase 5, Step 5.10).
// Opens on all clients simultaneously when any player presses "End Game".
// Server broadcasts "gameOverPrompt" → lobby reducer sets gameOverPrompt = true.
// Server broadcasts "gameOverCancelled" → lobby reducer sets gameOverPrompt = false.
// "End Game & Record" emits submitGameOver { result, notes, tags }.
// "Cancel" emits cancelGameOver.

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal, Button, Form, Badge } from 'react-bootstrap';
import { sendGameMessage } from '../../redux/actions';
import { selectCurrentGame } from '../../redux/selectors/game';

/**
 * @param {{ show: boolean, onClose: () => void }} props
 */
const GameOverModal = ({ show, onClose }) => {
    const dispatch = useDispatch();
    const currentGame = useSelector(selectCurrentGame);

    const [result, setResult] = useState('');
    const [notes, setNotes] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');

    // Derive auto-tags from current game state (mirrors server-side _deriveVersionTags)
    const autoTags = React.useMemo(() => {
        if (!currentGame) return [];
        const t = [];
        (currentGame.heroes || []).forEach((hero) => {
            if (hero.deckId && hero.deckVersion) t.push(`deck:${hero.deckId}@${hero.deckVersion}`);
        });
        if (currentGame.villain) {
            const v = currentGame.villain;
            if (v.deckId && v.deckVersion) t.push(`deck:${v.deckId}@${v.deckVersion}`);
        }
        if (currentGame.environment) {
            const e = currentGame.environment;
            if (e.deckId && e.deckVersion) t.push(`deck:${e.deckId}@${e.deckVersion}`);
        }
        return t;
    }, [currentGame]);

    const allTags = [...new Set([...autoTags, ...tags])];

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!allTags.includes(tagInput.trim())) {
                setTags((prev) => [...prev, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag) => {
        // Only remove user-added tags; auto-tags are read-only display
        setTags((prev) => prev.filter((t) => t !== tag));
    };

    const handleSubmit = () => {
        if (!result) return;
        dispatch(sendGameMessage('submitGameOver', { result, notes, tags: allTags }));
        onClose();
    };

    const handleCancel = () => {
        dispatch(sendGameMessage('cancelGameOver', {}));
        onClose();
    };

    return (
        <Modal show={show} onHide={handleCancel} backdrop='static' keyboard={false}>
            <Modal.Header>
                <Modal.Title>End Game</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group className='mb-3'>
                        <Form.Label>Result</Form.Label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <Form.Check
                                type='radio'
                                id='result-heroes-won'
                                label='Heroes Won'
                                value='heroVictory'
                                checked={result === 'heroVictory'}
                                onChange={(e) => setResult(e.target.value)}
                            />
                            <Form.Check
                                type='radio'
                                id='result-villain-won'
                                label='Villain Won'
                                value='villainVictory'
                                checked={result === 'villainVictory'}
                                onChange={(e) => setResult(e.target.value)}
                            />
                        </div>
                    </Form.Group>

                    <Form.Group className='mb-3'>
                        <Form.Label>Notes</Form.Label>
                        <Form.Control
                            as='textarea'
                            rows={3}
                            placeholder='Optional notes about this game…'
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </Form.Group>

                    <Form.Group className='mb-3'>
                        <Form.Label>Tags</Form.Label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                            {autoTags.map((tag) => (
                                <Badge key={tag} bg='secondary' style={{ fontSize: '0.75rem' }}>
                                    {tag}
                                </Badge>
                            ))}
                            {tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    bg='primary'
                                    style={{ fontSize: '0.75rem', cursor: 'pointer' }}
                                    onClick={() => handleRemoveTag(tag)}
                                    title='Click to remove'
                                >
                                    {tag} ×
                                </Badge>
                            ))}
                        </div>
                        <Form.Control
                            type='text'
                            placeholder='Add tag (press Enter)…'
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                        />
                        <Form.Text className='text-muted'>
                            Auto-tags (grey) are recorded automatically. Click blue tags to remove.
                        </Form.Text>
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant='secondary' onClick={handleCancel}>
                    Cancel
                </Button>
                <Button
                    variant='danger'
                    disabled={!result}
                    onClick={handleSubmit}
                >
                    End Game &amp; Record
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default GameOverModal;
