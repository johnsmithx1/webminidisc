// MiniDisc Studio fork demo: visual-only walkthrough; does not access NetMD/WebUSB. 2026-09-16.
import React, { useEffect, useState } from 'react';

const tracks = [
    { title: 'Crystal Cities', artist: 'Neon Arcade', time: '03:42' },
    { title: 'Blue Static', artist: 'The Afterglow', time: '04:18' },
    { title: 'Echoes at 2AM', artist: 'Neon Arcade', time: '03:56' },
    { title: 'Slow Motion', artist: 'Lunar Twin', time: '05:09' },
];

const duration = 11_000;

const StudioDemo = () => {
    const [elapsed, setElapsed] = useState(0);
    const [paused, setPaused] = useState(false);
    const phase = elapsed < 2300 ? 'loading' : elapsed < 4900 ? 'ready' : elapsed < duration ? 'transfer' : 'complete';
    const progress = phase === 'transfer' ? Math.min(100, Math.round(((elapsed - 4900) / (duration - 4900)) * 100)) : phase === 'complete' ? 100 : 0;

    useEffect(() => {
        if (paused || elapsed >= duration) return undefined;
        const timer = window.setInterval(() => setElapsed((time) => Math.min(time + 100, duration)), 100);
        return () => window.clearInterval(timer);
    }, [paused, elapsed]);

    const replay = () => {
        setElapsed(0);
        setPaused(false);
    };

    const phaseText = {
        loading: 'Reading disc…',
        ready: 'Disc ready · 4 tracks found',
        transfer: `Transferring “${tracks[2].title}” · ${progress}%`,
        complete: 'Transfer complete · Track added',
    }[phase];

    return (
        <section className="studio-demo" aria-label="MiniDisc Studio interface simulation">
            <div className="studio-demo-topline">
                <div><span className="studio-demo-live-dot" /> INTERACTIVE PREVIEW</div>
                <span className="studio-demo-badge">SIMULATION · NO HARDWARE</span>
            </div>

            <div className="studio-demo-heading">
                <div>
                    <div className="studio-demo-eyebrow">YOUR DECK, AT A GLANCE</div>
                    <h1>{phase === 'loading' ? 'Waking up the deck' : 'Neon Afterglow'}</h1>
                    <p>{phase === 'loading' ? 'The interface is checking the disc and reading its track list.' : 'MiniDisc · SP stereo · 4 tracks · 16:42 available'}</p>
                </div>
                <div className={`studio-demo-state studio-demo-state-${phase}`}><i /> {phase === 'loading' ? 'READING' : phase === 'transfer' ? 'IN PROGRESS' : phase === 'complete' ? 'ALL SET' : 'DISC LOADED'}</div>
            </div>

            <div className="studio-demo-grid">
                <div className="studio-demo-disc-panel">
                    <div className={`studio-demo-disc-wrap ${phase === 'loading' ? 'is-loading' : ''}`}>
                        <div className="studio-demo-disc"><div className="studio-demo-disc-label"><b>MD</b><span>NEON<br />AFTERGLOW</span></div></div>
                        <div className="studio-demo-disc-orbit" />
                    </div>
                    <div className="studio-demo-disc-meta"><span>DISC CAPACITY</span><b>34:12 <small>/ 80:00</small></b></div>
                    <div className="studio-demo-storage"><span /></div>
                    <div className="studio-demo-actions">
                        <button type="button" onClick={() => setPaused(!paused)} disabled={phase === 'complete'}>{paused ? '▶ Resume preview' : 'Ⅱ Pause preview'}</button>
                        <button type="button" onClick={replay}>↻ Replay</button>
                    </div>
                </div>

                <div className="studio-demo-track-panel">
                    <div className="studio-demo-track-header"><div><span>DISC CONTENTS</span><b>Track list</b></div><span className="studio-demo-track-count">04 TRACKS</span></div>
                    <div className="studio-demo-track-list">
                        {tracks.map((track, index) => {
                            const active = phase === 'transfer' && index === 2;
                            return <div className={`studio-demo-track ${active ? 'is-active' : ''}`} key={track.title}>
                                <span className="studio-demo-track-number">{String(index + 1).padStart(2, '0')}</span>
                                <span className="studio-demo-track-copy"><b>{track.title}</b><small>{track.artist}</small></span>
                                {active ? <span className="studio-demo-mini-bars" aria-label="Playing"><i /><i /><i /><i /><i /></span> : null}
                                <span className="studio-demo-track-time">{track.time}</span>
                            </div>;
                        })}
                    </div>
                    <div className={`studio-demo-transfer ${phase === 'transfer' || phase === 'complete' ? 'is-visible' : ''}`}>
                        <div className="studio-demo-transfer-top"><span><i /> {phaseText}</span><b>{progress}%</b></div>
                        <div className="studio-demo-progress"><span style={{ width: `${progress}%` }} /></div>
                        <div className="studio-demo-transfer-foot"><span>USB → MiniDisc</span><span>{phase === 'complete' ? 'Ready for another transfer' : 'ATRAC · SP stereo'}</span></div>
                    </div>
                </div>
            </div>

            <div className="studio-demo-footer"><span className="studio-demo-wave" aria-hidden="true">{Array.from({ length: 40 }, (_, index) => <i key={index} style={{ '--bar': `${12 + ((index * 29 + 17) % 70)}%` } as React.CSSProperties} />)}</span><span>{phaseText}</span><span>{paused ? 'PAUSED' : phase === 'complete' ? 'DONE' : 'LIVE PREVIEW'}</span></div>
        </section>
    );
};

export default StudioDemo;
