// SotMDE SotmGameChat component (Phase 5).
// Simple chat panel for the SotMDE board. Does not use the Ashteki Messages.jsx
// (which depends on currentGame.players structure that doesn't exist in SotMDE).
// Displays chatLog entries and allows sending messages.

import React, { useState, useRef, useEffect } from 'react';

/**
 * @param {{
 *   messages: Array<{ text: string, type?: string }>,
 *   onSendChat: (text: string) => void,
 *   muted?: boolean
 * }} props
 */
const SotmGameChat = ({ messages = [], onSendChat, muted = false }) => {
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = () => {
        const text = input.trim();
        if (!text || muted) return;
        onSendChat(text);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const panelStyle = {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#161b22',
        borderLeft: '1px solid #30363d'
    };

    const headerStyle = {
        padding: '8px 12px',
        borderBottom: '1px solid #30363d',
        fontSize: '0.8rem',
        color: '#8b949e',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    };

    const messagesStyle = {
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    };

    const inputRowStyle = {
        display: 'flex',
        borderTop: '1px solid #30363d',
        padding: '6px',
        gap: '6px'
    };

    const inputStyle = {
        flex: 1,
        backgroundColor: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '4px',
        color: '#f0f6fc',
        padding: '4px 8px',
        fontSize: '0.85rem',
        outline: 'none'
    };

    const sendBtnStyle = {
        backgroundColor: '#21262d',
        border: '1px solid #30363d',
        color: '#f0f6fc',
        borderRadius: '4px',
        padding: '4px 10px',
        cursor: muted ? 'not-allowed' : 'pointer',
        fontSize: '0.8rem'
    };

    const getMessageStyle = (type) => {
        switch (type) {
            case 'system':
                return { color: '#8b949e', fontStyle: 'italic', fontSize: '0.75rem' };
            case 'action':
                return { color: '#79c0ff', fontSize: '0.8rem' };
            default:
                return { color: '#f0f6fc', fontSize: '0.82rem' };
        }
    };

    return (
        <div style={panelStyle}>
            <div style={headerStyle}>Game Chat</div>
            <div style={messagesStyle}>
                {messages.map((msg, idx) => {
                    const text =
                        typeof msg === 'string'
                            ? msg
                            : msg.text || msg.message || JSON.stringify(msg);
                    const type = msg && msg.type;
                    return (
                        <div key={idx} style={getMessageStyle(type)}>
                            {text}
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
            <div style={inputRowStyle}>
                <input
                    style={inputStyle}
                    type='text'
                    placeholder={muted ? 'Chat muted' : 'Message…'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={muted}
                />
                <button style={sendBtnStyle} onClick={handleSend} disabled={muted}>
                    Send
                </button>
            </div>
        </div>
    );
};

export default SotmGameChat;
