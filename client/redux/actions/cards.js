export function loadAlts() {
    return {
        types: ['REQUEST_ALTS', 'RECEIVE_ALTS'],
        shouldCallAPI: (state) => {
            return !state.cards.alts || Object.values(state.cards.alts).length === 0;
        },
        APIParams: { url: '/api/cards/alts', cache: false }
    };
}
