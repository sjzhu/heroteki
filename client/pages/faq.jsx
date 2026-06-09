import React from 'react';
import { Col, Row } from 'react-bootstrap';
import './Home.scss';

import Panel from '../Components/Site/Panel';
import ManualCommands from './ManualCommands';

const FAQ = () => {
    return (
        <Row>
            <Col className='full-height lobby-content' md='6'>
                <Panel type='lobby' cardClass='lobby-card'>
                    <h2>Frequently Asked Questions</h2>
                    <h3>What is SotMDE Online?</h3>
                    <div className='faq-entry'>
                        <p>
                            SotMDE Online is a browser-based facilitator for playing Sentinels of
                            the Multiverse: Definitive Edition. No rules are automated — all card
                            effects are resolved manually by the players. The app tracks zone
                            contents, HP, turn phase, and game state.
                        </p>
                    </div>
                    <h3>Where can I find other players?</h3>
                    <div className='faq-entry'>
                        <p>
                            Check the lobby — other players will be listed there when they are
                            online.
                        </p>
                    </div>
                    <h3>Where can I learn about the game?</h3>
                    <div className='faq-entry'>
                        <p>
                            See the official{' '}
                            <a
                                target='_blank'
                                rel='noopener noreferrer'
                                href='https://sentinelsofthemultiverse.com'
                            >
                                Sentinels of the Multiverse
                            </a>{' '}
                            website for rules and lore.
                        </p>
                    </div>
                </Panel>
            </Col>
            <Col className='full-height lobby-content' md='6'>
                <Panel type='lobby' cardClass='lobby-card'>
                    <ManualCommands />
                </Panel>
            </Col>
        </Row>
    );
};

export default FAQ;
