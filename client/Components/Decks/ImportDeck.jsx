/**
 * SotMDE ImportDeck.jsx — stub. ashes.live deck import is not available in SotMDE.
 * The original ashes.live import functionality has been removed.
 * Use the Upload Deck feature (/decks/upload) to add custom decks.
 */
import React from 'react';
import { Col } from 'react-bootstrap';
import Panel from '../Site/Panel';

const ImportDeck = () => {
    return (
        <div>
            <Col md={{ span: 8, offset: 2 }} className='profile full-height'>
                <Panel title='Import Deck'>
                    <p>
                        ashes.live deck import is not available in SotMDE.
                    </p>
                    <p>
                        To add custom hero, villain, or environment decks, use the{' '}
                        <a href='/decks/upload'>Upload Deck</a> feature.
                    </p>
                </Panel>
            </Col>
        </div>
    );
};

ImportDeck.displayName = 'ImportDeck';
export default ImportDeck;
