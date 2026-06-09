/**
 * SotMDE Stats.jsx — player profile statistics page.
 * Removed Ashes-specific per-Phoenixborn stats. Shows generic games played / wins only.
 * Future: will show SotMDE win/loss by villain and hero deck.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import AlertPanel from '../../Components/Site/AlertPanel';
import * as actions from '../../redux/actions';

function Stats() {
    const [selectedTerm, setSelectedTerm] = useState(0);
    const stats = useSelector((state) => state.stats && state.stats.stats);
    const apiLoading = useSelector((state) =>
        state.api.REQUEST_USERSTATS ? state.api.REQUEST_USERSTATS.loading : undefined
    );
    const apiMessage = useSelector((state) =>
        state.api.REQUEST_USERSTATS ? state.api.REQUEST_USERSTATS.message : undefined
    );
    const apiSuccess = useSelector((state) =>
        state.api.REQUEST_USERSTATS ? state.api.REQUEST_USERSTATS.success : undefined
    );
    const dispatch = useDispatch();

    const loadUserStats = useCallback(() => {
        dispatch(actions.loadUserStats(selectedTerm, null));
    }, [dispatch, selectedTerm]);

    useEffect(() => {
        loadUserStats();
    }, [loadUserStats]);

    const handleChange = useCallback((event) => {
        setSelectedTerm(event.target.value);
    }, []);

    let content = null;

    if (apiLoading) {
        content = <div>Loading games from the server...</div>;
    } else if (!apiSuccess) {
        content = <AlertPanel type='error' message={apiMessage} />;
    } else {
        // Generic totals — don't break if stats is shaped like old Ashes format
        let totalWins = 0;
        let totalLosses = 0;
        let totalPlayed = 0;

        if (stats) {
            const entries = Object.values(stats);
            totalWins = entries.reduce((sum, s) => sum + (s.wins || 0), 0);
            totalLosses = entries.reduce((sum, s) => sum + (s.losses || 0), 0);
            totalPlayed =
                entries.reduce((sum, s) => sum + (s.total || 0), 0) || totalWins + totalLosses;
        }

        const winRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0;

        content = (
            <div>
                <div className='profile full-height'>
                    <div className='col-md-6 inline'>
                        <select
                            className='form-control'
                            value={selectedTerm}
                            onChange={handleChange}
                        >
                            <option value='0'>All games</option>
                            <option value='1'>Last 1 month</option>
                            <option value='3'>Last 3 months</option>
                            <option value='12'>Last 12 months</option>
                        </select>
                    </div>

                    <div className='mt-3'>
                        {totalPlayed === 0 ? (
                            <div>You have no recorded games.</div>
                        ) : (
                            <table className='table table-striped table-dark'>
                                <thead>
                                    <tr>
                                        <th>Wins</th>
                                        <th>Losses</th>
                                        <th>Total</th>
                                        <th>Win Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>{totalWins}</td>
                                        <td>{totalLosses}</td>
                                        <td>{totalPlayed}</td>
                                        <td>{winRate}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return content;
}

Stats.displayName = 'Stats';
export default Stats;
