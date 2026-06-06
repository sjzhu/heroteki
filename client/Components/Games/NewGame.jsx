/**
 * SotMDE NewGame.jsx — game creation form.
 * Stripped of all Ashes-specific fields (ranked, format, clock, time limit, solo, saveReplay).
 * Added villain and environment deck selectors fetched from /api/sotm/decks.
 */
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Form, Button, Col } from 'react-bootstrap';
import { Formik } from 'formik';
import * as yup from 'yup';

import { cancelNewGame, sendSocketMessage } from '../../redux/actions';
import { getStandardControlProps } from '../../util';

import './NewGame.scss';
import PictureButton from '../Lobby/PictureButton';
import { getGameTypeLabel } from '../../util';

const GameNameMaxLength = 64;

const NewGame = ({ onClosed }) => {
    const lobbySocket = useSelector((state) => state.lobby.socket);
    const username = useSelector((state) => state.account.user?.username);
    const newGameType = useSelector((state) => state.lobby.newGameType);

    const dispatch = useDispatch();

    const [villainDecks, setVillainDecks] = useState([]);
    const [environmentDecks, setEnvironmentDecks] = useState([]);
    const [decksLoading, setDecksLoading] = useState(true);

    useEffect(() => {
        const fetchDecks = async () => {
            try {
                const [vRes, eRes] = await Promise.all([
                    fetch('/api/sotm/decks?type=villain'),
                    fetch('/api/sotm/decks?type=environment')
                ]);
                if (vRes.ok) setVillainDecks(await vRes.json());
                if (eRes.ok) setEnvironmentDecks(await eRes.json());
            } catch (err) {
                // non-fatal — selects will just be empty
            } finally {
                setDecksLoading(false);
            }
        };
        fetchDecks();
    }, []);

    const schema = yup.object({
        name: yup
            .string()
            .required('You must specify a name for the game')
            .max(GameNameMaxLength, `Game name must be less than ${GameNameMaxLength} characters`),
        password: yup.string().optional(),
        allowSpectators: yup.boolean(),
        villainDeckId: yup.string().required('You must select a villain'),
        environmentDeckId: yup.string().required('You must select an environment')
    });

    const initialValues = {
        name: `${username}'s game`,
        password: '',
        allowSpectators: true,
        newGameType: newGameType,
        gameType: 'casual',
        gameFormat: 'standard',
        villainDeckId: '',
        environmentDeckId: ''
    };

    if (!lobbySocket) {
        return (
            <div>
                The connection to the lobby has been lost, waiting for it to be restored. If this
                message persists, please refresh the page.
            </div>
        );
    }

    return (
        <div>
            <Formik
                enableReinitialize={true}
                validationSchema={schema}
                onSubmit={(values) => {
                    dispatch(sendSocketMessage('newgame', values));
                }}
                initialValues={initialValues}
            >
                {(formProps) => (
                    <Form
                        onSubmit={(event) => {
                            event.preventDefault();
                            formProps.handleSubmit(event);
                        }}
                    >
                        <div className='newgame-header'>
                            <PictureButton
                                text={getGameTypeLabel(newGameType)}
                                disabled={true}
                                imageClass={newGameType}
                            />
                            <Col>
                                <Form.Group controlId='formGridGameName' className='mb-3'>
                                    <Form.Label>Name</Form.Label>
                                    <Form.Control
                                        type='text'
                                        placeholder='Game Name'
                                        maxLength={GameNameMaxLength}
                                        {...getStandardControlProps(formProps, 'name')}
                                    />
                                    <Form.Control.Feedback type='invalid'>
                                        {formProps.errors.name}
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                        </div>

                        {/* Villain selector */}
                        <Form.Group className='mb-3' controlId='villainDeckId'>
                            <Form.Label>Villain</Form.Label>
                            <Form.Select
                                disabled={decksLoading}
                                {...getStandardControlProps(formProps, 'villainDeckId')}
                                onChange={(e) =>
                                    formProps.setFieldValue('villainDeckId', e.target.value)
                                }
                            >
                                <option value=''>
                                    {decksLoading ? 'Loading...' : '— Select Villain —'}
                                </option>
                                {villainDecks.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                        {d.version ? ` (v${d.version})` : ''}
                                        {d.cardCount ? ` · ${d.cardCount} cards` : ''}
                                    </option>
                                ))}
                            </Form.Select>
                            {formProps.touched.villainDeckId && formProps.errors.villainDeckId && (
                                <Form.Control.Feedback type='invalid' style={{ display: 'block' }}>
                                    {formProps.errors.villainDeckId}
                                </Form.Control.Feedback>
                            )}
                        </Form.Group>

                        {/* Environment selector */}
                        <Form.Group className='mb-3' controlId='environmentDeckId'>
                            <Form.Label>Environment</Form.Label>
                            <Form.Select
                                disabled={decksLoading}
                                {...getStandardControlProps(formProps, 'environmentDeckId')}
                                onChange={(e) =>
                                    formProps.setFieldValue('environmentDeckId', e.target.value)
                                }
                            >
                                <option value=''>
                                    {decksLoading ? 'Loading...' : '— Select Environment —'}
                                </option>
                                {environmentDecks.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                        {d.version ? ` (v${d.version})` : ''}
                                        {d.cardCount ? ` · ${d.cardCount} cards` : ''}
                                    </option>
                                ))}
                            </Form.Select>
                            {formProps.touched.environmentDeckId &&
                                formProps.errors.environmentDeckId && (
                                    <Form.Control.Feedback
                                        type='invalid'
                                        style={{ display: 'block' }}
                                    >
                                        {formProps.errors.environmentDeckId}
                                    </Form.Control.Feedback>
                                )}
                        </Form.Group>

                        {/* Password */}
                        <Form.Group className='mb-3' controlId='password'>
                            <Form.Label>Password (optional)</Form.Label>
                            <Form.Control
                                type='text'
                                placeholder='Leave blank for open game'
                                autoComplete='off'
                                {...getStandardControlProps(formProps, 'password')}
                            />
                        </Form.Group>

                        {/* Allow spectators */}
                        <Form.Group className='mb-3'>
                            <Form.Check
                                type='switch'
                                id='allowSpectators'
                                label='Allow spectators'
                                checked={formProps.values.allowSpectators}
                                onChange={(e) =>
                                    formProps.setFieldValue('allowSpectators', e.target.checked)
                                }
                            />
                        </Form.Group>

                        <div className='text-center newgame-buttons'>
                            <Button
                                variant='primary'
                                className='def'
                                onClick={() => {
                                    dispatch(cancelNewGame());
                                    if (onClosed) {
                                        onClosed(false);
                                    }
                                }}
                            >
                                Cancel
                            </Button>
                            <Button variant='success' type='submit' className='def'>
                                Create
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

NewGame.displayName = 'NewGame';
export default NewGame;
