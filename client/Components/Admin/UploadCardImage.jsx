/**
 * SotMDE UploadCardImage.jsx — admin-only card image upload UI.
 * Allows admins to upload a JPEG/PNG/WebP image for a specific card.
 * POST to /api/admin/cards/upload-image (multipart/form-data).
 * Visible only to users with isAdmin permission.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Col, Button, Spinner, Form } from 'react-bootstrap';
import Panel from '../Site/Panel';

const UploadCardImage = () => {
    const user = useSelector((state) => state.account.user);

    const [cardId, setCardId] = useState('');
    const [cardSuggestions, setCardSuggestions] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const fileRef = useRef(null);

    // Autocomplete: fetch cards matching the typed cardId
    useEffect(() => {
        if (cardId.length < 2) {
            setCardSuggestions([]);
            return;
        }
        const controller = new AbortController();
        fetch(`/api/sotm/cards?source=&deckId=`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : []))
            .then((cards) => {
                const matches = cards
                    .filter(
                        (c) =>
                            c.id?.toLowerCase().includes(cardId.toLowerCase()) ||
                            c.name?.toLowerCase().includes(cardId.toLowerCase())
                    )
                    .slice(0, 10);
                setCardSuggestions(matches);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [cardId]);

    if (!user?.permissions?.isAdmin) {
        return (
            <div className='p-4'>
                <div className='alert alert-danger'>
                    Admin access required to upload card images.
                </div>
            </div>
        );
    }

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setError(null);
    };

    const handleUpload = async () => {
        if (!cardId.trim()) {
            setError('Please enter a card ID.');
            return;
        }
        if (!fileRef.current?.files[0]) {
            setError('Please select an image file.');
            return;
        }

        setUploading(true);
        setResult(null);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('cardId', cardId.trim());
            formData.append('image', fileRef.current.files[0]);

            const res = await fetch('/api/admin/cards/upload-image', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || data.message || `Upload failed (HTTP ${res.status})`);
                return;
            }

            setResult(data);
            // Update preview to the new server URL
            if (data.imageUrl) {
                setPreviewUrl(data.imageUrl);
            }
        } catch (err) {
            setError('Unexpected error: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <Col md={{ span: 8, offset: 2 }} className='profile full-height'>
                <Panel title='Upload Card Image (Admin)'>
                    <p>Upload a card image for a specific card ID.</p>
                    <p>
                        Accepted formats: JPEG, PNG, WebP. Max file size: 3 MB.
                        The image will be stored in <code>/public/card-images/manual/</code>.
                    </p>

                    {/* Card ID input with autocomplete */}
                    <Form.Group className='mb-3'>
                        <Form.Label>Card ID</Form.Label>
                        <Form.Control
                            type='text'
                            placeholder='e.g. legacy-02'
                            value={cardId}
                            onChange={(e) => setCardId(e.target.value)}
                            list='card-id-suggestions'
                            autoComplete='off'
                        />
                        <datalist id='card-id-suggestions'>
                            {cardSuggestions.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.deckId})
                                </option>
                            ))}
                        </datalist>
                        <Form.Text className='text-muted'>
                            Type to search cards by ID or name.
                        </Form.Text>
                    </Form.Group>

                    {/* File picker */}
                    <Form.Group className='mb-3'>
                        <Form.Label>Image File</Form.Label>
                        <Form.Control
                            ref={fileRef}
                            type='file'
                            accept='image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
                            onChange={handleFileSelect}
                        />
                    </Form.Group>

                    {/* Preview */}
                    {previewUrl && (
                        <div className='mb-3'>
                            <img
                                src={previewUrl}
                                alt='Card preview'
                                style={{ maxWidth: '200px', maxHeight: '280px', objectFit: 'contain', border: '1px solid #555', borderRadius: '4px' }}
                            />
                        </div>
                    )}

                    {error && <div className='alert alert-danger mb-3'>{error}</div>}
                    {result && (
                        <div className='alert alert-success mb-3'>
                            <strong>Success!</strong> Image uploaded for card{' '}
                            <code>{cardId}</code>.
                            <br />
                            New URL:{' '}
                            <a href={result.imageUrl} target='_blank' rel='noopener noreferrer'>
                                {result.imageUrl}
                            </a>
                        </div>
                    )}

                    <Button
                        variant='primary'
                        onClick={handleUpload}
                        disabled={uploading || !cardId.trim()}
                    >
                        {uploading ? (
                            <>
                                <Spinner animation='border' size='sm' /> Uploading...
                            </>
                        ) : (
                            'Upload Image'
                        )}
                    </Button>
                </Panel>
            </Col>
        </div>
    );
};

UploadCardImage.displayName = 'UploadCardImage';
export default UploadCardImage;
