/**
 * SotMDE UploadDeck.jsx — user deck upload UI.
 * Accepts a .json file, POSTs to /api/sotm/decks/upload, displays warnings
 * and import confirmation. Also shows "My Uploaded Decks" list with delete option.
 * After successful import, runs client-side image preload check for each imageUrl.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Col, Button, Spinner, Badge } from 'react-bootstrap';
import Panel from '../Site/Panel';

const UploadDeck = () => {
    const user = useSelector((state) => state.account.user);
    const fileRef = useRef(null);

    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const [imageWarnings, setImageWarnings] = useState([]);

    const [myDecks, setMyDecks] = useState([]);
    const [decksLoading, setDecksLoading] = useState(true);
    const [deleteError, setDeleteError] = useState(null);

    const loadMyDecks = async () => {
        setDecksLoading(true);
        try {
            const res = await fetch('/api/sotm/decks?source=user');
            if (res.ok) {
                const data = await res.json();
                // Show only this user's decks (server also filters, but belt-and-suspenders)
                setMyDecks(data);
            }
        } catch (_) {
            // non-fatal
        } finally {
            setDecksLoading(false);
        }
    };

    useEffect(() => {
        loadMyDecks();
    }, []);

    const checkImages = async (cards = []) => {
        const warnings = [];
        const checks = cards.map(
            (card) =>
                new Promise((resolve) => {
                    if (!card.imageUrl) {
                        resolve();
                        return;
                    }
                    const img = new Image();
                    img.onload = resolve;
                    img.onerror = () => {
                        warnings.push(`Image failed to load for card "${card.name}": ${card.imageUrl}`);
                        resolve();
                    };
                    img.src = card.imageUrl;
                })
        );
        await Promise.all(checks);
        setImageWarnings(warnings);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadResult(null);
        setUploadError(null);
        setImageWarnings([]);

        try {
            const text = await file.text();
            let payload;
            try {
                payload = JSON.parse(text);
            } catch (parseErr) {
                setUploadError('Invalid JSON file: ' + parseErr.message);
                setUploading(false);
                return;
            }

            const res = await fetch('/api/sotm/decks/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (!res.ok) {
                setUploadError(result.error || result.message || `Upload failed (HTTP ${res.status})`);
                setUploading(false);
                return;
            }

            setUploadResult(result);

            // Client-side image preload check
            const allCards = [
                ...(payload.cards || []),
                payload.characterCard
            ].filter(Boolean);
            await checkImages(allCards);

            // Reload deck list
            await loadMyDecks();
        } catch (err) {
            setUploadError('Unexpected error: ' + err.message);
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleDelete = async (deckId) => {
        if (!window.confirm(`Delete deck "${deckId}"? This cannot be undone.`)) return;
        setDeleteError(null);
        try {
            const res = await fetch(`/api/sotm/decks/${deckId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                setDeleteError(data.error || `Delete failed (HTTP ${res.status})`);
                return;
            }
            await loadMyDecks();
        } catch (err) {
            setDeleteError('Delete failed: ' + err.message);
        }
    };

    if (!user) {
        return <div className='p-3'>You must be logged in to upload decks.</div>;
    }

    return (
        <div>
            <Col md={{ span: 10, offset: 1 }} className='profile full-height'>
                {/* Upload form */}
                <Panel title='Upload Deck'>
                    <p>
                        Upload a JSON deck file. The JSON must contain a <code>deck</code>,{' '}
                        <code>characterCard</code>, and <code>cards</code> array conforming to the
                        SotMDE deck schema.
                    </p>

                    <input
                        ref={fileRef}
                        type='file'
                        accept='.json,application/json'
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        id='deck-upload-input'
                    />
                    <label htmlFor='deck-upload-input'>
                        <Button
                            as='span'
                            variant='primary'
                            disabled={uploading}
                            style={{ cursor: 'pointer' }}
                            onClick={() => fileRef.current?.click()}
                        >
                            {uploading ? (
                                <>
                                    <Spinner animation='border' size='sm' /> Uploading...
                                </>
                            ) : (
                                'Choose JSON File'
                            )}
                        </Button>
                    </label>

                    {uploadError && (
                        <div className='alert alert-danger mt-3'>
                            <strong>Upload failed:</strong> {uploadError}
                        </div>
                    )}

                    {uploadResult && (
                        <div className='mt-3'>
                            <div className='alert alert-success'>
                                <strong>Success!</strong> Imported deck{' '}
                                <code>{uploadResult.deckId}</code> with{' '}
                                {uploadResult.cardCount} card(s).
                            </div>
                            {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                                <div className='alert alert-warning'>
                                    <strong>Warnings:</strong>
                                    <ul className='mb-0 mt-1'>
                                        {uploadResult.warnings.map((w, i) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {imageWarnings.length > 0 && (
                                <div className='alert alert-warning'>
                                    <strong>Image load failures (client-side check):</strong>
                                    <ul className='mb-0 mt-1'>
                                        {imageWarnings.map((w, i) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </Panel>

                {/* My Uploaded Decks list */}
                <Panel title='My Uploaded Decks' className='mt-4'>
                    {deleteError && (
                        <div className='alert alert-danger'>{deleteError}</div>
                    )}
                    {decksLoading ? (
                        <div className='text-center p-3'>
                            <Spinner animation='border' size='sm' /> Loading...
                        </div>
                    ) : myDecks.length === 0 ? (
                        <div className='text-muted'>No decks uploaded yet.</div>
                    ) : (
                        <table className='table table-dark table-striped'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Version</th>
                                    <th>Cards</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {myDecks.map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.name}</td>
                                        <td>
                                            <Badge bg='secondary'>{d.deckType}</Badge>
                                        </td>
                                        <td>{d.version || '—'}</td>
                                        <td>{d.cardCount ?? '—'}</td>
                                        <td>
                                            <Button
                                                variant='outline-danger'
                                                size='sm'
                                                onClick={() => handleDelete(d.id)}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </Col>
        </div>
    );
};

UploadDeck.displayName = 'UploadDeck';
export default UploadDeck;
