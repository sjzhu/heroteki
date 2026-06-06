/**
 * SotMDE AddDeck.jsx — repurposed as the deck upload entry point.
 * Original Ashes deck editor functionality is removed; replaced by UploadDeck.
 * Route: /decks/add
 */
import React from 'react';
import UploadDeck from '../Components/Decks/UploadDeck';

export function AddDeckPage() {
    return <UploadDeck />;
}

AddDeckPage.displayName = 'AddDeck';
export default AddDeckPage;
