import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Input from '@mui/material/Input';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { useDispatch, useShallowEqualSelector } from '../frontend-utils';
import {
    actions as dspActions,
    EQ_BANDS_HZ,
    EQ_BAND_LABELS,
    EQ_PRESETS,
    EQ_RANGE_DB,
    LOUDNESS_TARGETS,
    effectivePreamp,
} from '../redux/dsp-feature';

const EQ_Q = 1.4; // must match services/audio/dsp.ts

const fmt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(1)}`;

const useStyles = makeStyles()((theme) => ({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1.5),
        width: '100%',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.spacing(2),
    },
    lcd: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 4,
        background: '#081008',
        border: '1px solid #2E3035',
        boxShadow: 'inset 0 3px 14px #000, inset 0 0 40px rgba(135,239,126,0.06)',
        '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage:
                'linear-gradient(rgba(0,0,0,.28) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.28) 1px,transparent 1px)',
            backgroundSize: '3px 3px',
        },
    },
    curve: {
        display: 'block',
        width: '100%',
        height: 72,
    },
    canvas: {
        display: 'block',
        width: '100%',
        height: 84,
    },
    faders: {
        display: 'grid',
        gridTemplateColumns: 'repeat(11, minmax(0, 1fr))',
        gap: 2,
        alignItems: 'end',
        opacity: 1,
    },
    fadersDisabled: {
        opacity: 0.45,
    },
    fader: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
    },
    faderLabel: {
        fontFamily: "'Geist Mono', ui-monospace, Menlo, monospace",
        fontSize: '0.65rem',
        letterSpacing: '0.06em',
        color: theme.palette.text.secondary,
        whiteSpace: 'nowrap',
    },
    slider: {
        height: 110,
    },
    note: {
        fontSize: '0.72rem',
    },
    select: {
        minWidth: 160,
    },
}));

function curvePath(gains: number[], w: number, h: number): string {
    const mid = h / 2;
    const amp = mid - 6;
    const y = (g: number) => mid - (g / EQ_RANGE_DB) * amp;
    const pts: [number, number][] = [[0, y(gains[0])]];
    gains.forEach((g, i) => pts.push([((i + 0.5) / gains.length) * w, y(g)]));
    pts.push([w, y(gains[gains.length - 1])]);
    let d = `M0 ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] ?? p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)},${c2[0].toFixed(1)} ${c2[1].toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
}

/** Web Audio preview chain that mirrors the ffmpeg EQ, feeding an analyser for the spectrum LCD. */
class PreviewEngine {
    ctx: AudioContext;
    source?: AudioBufferSourceNode;
    preamp: GainNode;
    filters: BiquadFilterNode[];
    analyser: AnalyserNode;
    onEnded?: () => void;

    constructor() {
        this.ctx = new AudioContext();
        this.preamp = this.ctx.createGain();
        this.filters = EQ_BANDS_HZ.map((f) => {
            const b = this.ctx.createBiquadFilter();
            b.type = 'peaking';
            b.frequency.value = f;
            b.Q.value = EQ_Q;
            return b;
        });
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.6;
        let node: AudioNode = this.preamp;
        for (const f of this.filters) {
            node.connect(f);
            node = f;
        }
        node.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    apply(enabled: boolean, gains: number[], preampDb: number) {
        const t = this.ctx.currentTime;
        this.preamp.gain.setTargetAtTime(enabled ? Math.pow(10, preampDb / 20) : 1, t, 0.02);
        this.filters.forEach((f, i) => f.gain.setTargetAtTime(enabled ? gains[i] : 0, t, 0.02));
    }

    async play(file: File) {
        const buffer = await this.ctx.decodeAudioData(await file.arrayBuffer());
        this.stopSource();
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.preamp);
        src.onended = () => this.onEnded?.();
        // Start a third of the way in: past most intros, into the part you actually want to judge.
        src.start(0, Math.min(buffer.duration * 0.33, Math.max(0, buffer.duration - 5)));
        this.source = src;
        await this.ctx.resume();
    }

    stopSource() {
        if (this.source) {
            this.source.onended = null;
            try {
                this.source.stop();
            } catch (e) {
                // already stopped
            }
            this.source.disconnect();
            this.source = undefined;
        }
    }

    close() {
        this.stopSource();
        this.ctx.close().catch(() => undefined);
    }
}

export const DspPanel = (props: { previewFile: File | null; previewTitle: string }) => {
    const { classes, cx } = useStyles();
    const dispatch = useDispatch();
    const dsp = useShallowEqualSelector((state) => state.dsp);
    const preamp = effectivePreamp(dsp);

    const engineRef = useRef<PreviewEngine | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number>(0);
    const [playing, setPlaying] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const peakBoost = Math.max(0, ...dsp.eqGains);
    const netPeak = dsp.eqEnabled ? peakBoost + preamp : 0;

    // Keep the live preview in sync with the faders.
    useEffect(() => {
        engineRef.current?.apply(dsp.eqEnabled, dsp.eqGains, preamp);
    }, [dsp.eqEnabled, dsp.eqGains, preamp]);

    const stop = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        engineRef.current?.close();
        engineRef.current = null;
        setPlaying(false);
    }, []);

    useEffect(() => stop, [stop]);
    useEffect(() => {
        // Changing the selected track stops the preview.
        stop();
    }, [props.previewFile, stop]);

    const draw = useCallback(() => {
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        if (!engine || !canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        const g = canvas.getContext('2d')!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);

        const bins = new Uint8Array(engine.analyser.frequencyBinCount);
        engine.analyser.getByteFrequencyData(bins);
        const bars = 40;
        const nyquist = engine.ctx.sampleRate / 2;
        const peaks: number[] = ((canvas as any).__peaks ||= new Array(bars).fill(0));
        const barW = w / bars;
        g.shadowColor = 'rgba(135,239,126,0.85)';
        g.shadowBlur = 8;
        for (let i = 0; i < bars; i++) {
            // Log-spaced bands, 40 Hz .. 18 kHz.
            const f0 = 40 * Math.pow(18000 / 40, i / bars);
            const f1 = 40 * Math.pow(18000 / 40, (i + 1) / bars);
            const b0 = Math.max(0, Math.floor((f0 / nyquist) * bins.length));
            const b1 = Math.min(bins.length - 1, Math.max(b0, Math.ceil((f1 / nyquist) * bins.length)));
            let v = 0;
            for (let b = b0; b <= b1; b++) v = Math.max(v, bins[b]);
            const bh = (v / 255) * (h - 6);
            // Fast attack, slow decay on the peak caps - phosphor persistence.
            peaks[i] = bh > peaks[i] ? bh : Math.max(bh, peaks[i] - 0.9);
            const x = i * barW + 1;
            for (let y = h - 3; y > h - bh; y -= 4) {
                g.fillStyle = '#87EF7E';
                g.fillRect(x, y - 3, barW - 2, 3);
            }
            g.fillStyle = '#F6FFBF';
            g.fillRect(x, h - peaks[i] - 5, barW - 2, 2);
        }
        rafRef.current = requestAnimationFrame(draw);
    }, []);

    const play = useCallback(async () => {
        if (!props.previewFile) return;
        setPreviewError(null);
        stop();
        const engine = new PreviewEngine();
        engine.apply(dsp.eqEnabled, dsp.eqGains, preamp);
        engine.onEnded = stop;
        engineRef.current = engine;
        try {
            await engine.play(props.previewFile);
            setPlaying(true);
            rafRef.current = requestAnimationFrame(draw);
        } catch (e) {
            console.error(e);
            setPreviewError('Your browser cannot decode this file for preview. The EQ still applies at encode time.');
            stop();
        }
    }, [props.previewFile, dsp.eqEnabled, dsp.eqGains, preamp, draw, stop]);

    const curve = useMemo(() => curvePath(dsp.eqEnabled ? dsp.eqGains : dsp.eqGains.map(() => 0), 600, 72), [dsp.eqEnabled, dsp.eqGains]);

    return (
        <div className={classes.root}>
            <div className={classes.row}>
                <FormControlLabel
                    control={<Switch checked={dsp.eqEnabled} onChange={(e) => dispatch(dspActions.setEqEnabled(e.target.checked))} />}
                    label="10-band EQ"
                />
                <Select
                    className={classes.select}
                    value={EQ_PRESETS.some((p) => p.id === dsp.eqPreset) ? dsp.eqPreset : 'custom'}
                    input={<Input />}
                    onChange={(e) => dispatch(dspActions.applyEqPreset(e.target.value as string))}
                    disabled={!dsp.eqEnabled}
                >
                    {EQ_PRESETS.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                            {p.name}
                        </MenuItem>
                    ))}
                    <MenuItem value="custom" disabled>
                        Custom
                    </MenuItem>
                </Select>
                <FormControlLabel
                    control={
                        <Switch
                            checked={dsp.eqAutoGain}
                            disabled={!dsp.eqEnabled}
                            onChange={(e) => dispatch(dspActions.setEqAutoGain(e.target.checked))}
                        />
                    }
                    label="Auto-gain"
                />
            </div>

            <div className={classes.lcd}>
                <svg className={classes.curve} viewBox="0 0 600 72" preserveAspectRatio="none" aria-label="EQ response curve">
                    <line x1="0" y1="36" x2="600" y2="36" stroke="#1F3A1E" strokeDasharray="4 4" />
                    <path d={`${curve} L600 36 L0 36 Z`} fill={dsp.eqEnabled ? 'rgba(135,239,126,0.12)' : 'transparent'} />
                    <path
                        d={curve}
                        fill="none"
                        stroke={dsp.eqEnabled ? '#87EF7E' : '#35533A'}
                        strokeWidth="2.5"
                        style={{ filter: dsp.eqEnabled ? 'drop-shadow(0 0 3px rgba(135,239,126,.8))' : undefined }}
                    />
                </svg>
            </div>

            <div className={cx(classes.faders, { [classes.fadersDisabled]: !dsp.eqEnabled })}>
                <div className={classes.fader}>
                    <span className={classes.faderLabel}>PRE</span>
                    <Slider
                        className={classes.slider}
                        orientation="vertical"
                        size="small"
                        color="warning"
                        min={-EQ_RANGE_DB}
                        max={EQ_RANGE_DB}
                        step={0.5}
                        value={preamp}
                        disabled={!dsp.eqEnabled}
                        onChange={(_e, v) => dispatch(dspActions.setEqPreamp(v as number))}
                        aria-label="Preamp"
                    />
                    <span className={classes.faderLabel}>{fmt(preamp)}</span>
                </div>
                {EQ_BAND_LABELS.map((label, i) => (
                    <div className={classes.fader} key={label}>
                        <span className={classes.faderLabel}>{label}</span>
                        <Slider
                            className={classes.slider}
                            orientation="vertical"
                            size="small"
                            min={-EQ_RANGE_DB}
                            max={EQ_RANGE_DB}
                            step={0.5}
                            value={dsp.eqGains[i]}
                            disabled={!dsp.eqEnabled}
                            onChange={(_e, v) => dispatch(dspActions.setEqBand({ index: i, gain: v as number }))}
                            aria-label={`${label} Hz`}
                        />
                        <span className={classes.faderLabel}>{fmt(dsp.eqGains[i])}</span>
                    </div>
                ))}
            </div>
            {dsp.eqEnabled && netPeak > 0 && (
                <Typography color="warning.main" className={classes.note}>
                    Clip risk: boosts exceed the preamp by {netPeak.toFixed(1)} dB. Turn on Auto-gain or a loudness target.
                </Typography>
            )}

            <div className={classes.row}>
                <Typography variant="body2">Loudness target</Typography>
                <Select
                    className={classes.select}
                    value={dsp.loudnessTarget === null ? 'off' : String(dsp.loudnessTarget)}
                    input={<Input />}
                    onChange={(e) => {
                        const v = e.target.value as string;
                        dispatch(dspActions.setLoudnessTarget(v === 'off' ? null : parseFloat(v)));
                    }}
                >
                    {LOUDNESS_TARGETS.map((t) => (
                        <MenuItem key={String(t)} value={t === null ? 'off' : String(t)}>
                            {t === null ? 'Off' : `${t} LUFS${t === -16 ? ' (recommended)' : ''}`}
                        </MenuItem>
                    ))}
                </Select>
            </div>
            <Typography color="textSecondary" className={classes.note}>
                Loudness is two-pass (measure, then apply a fixed gain with a {dsp.loudnessTruePeak} dBTP ceiling), so each track takes
                roughly twice as long to convert. DSP is baked into the audio written to the disc. Tracks from a remote library are uploaded
                without DSP.
            </Typography>

            <div className={classes.lcd}>
                <canvas ref={canvasRef} className={classes.canvas} aria-label="Spectrum analyser" />
            </div>
            <div className={classes.row}>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={playing ? <StopIcon /> : <PlayArrowIcon />}
                    onClick={playing ? stop : play}
                    disabled={!props.previewFile}
                >
                    {playing ? 'Stop preview' : 'Preview EQ'}
                </Button>
                <Typography variant="caption" color="textSecondary" noWrap style={{ flex: '1 1 0', minWidth: 0 }}>
                    {props.previewFile ? `Selected: ${props.previewTitle || props.previewFile.name}` : 'Select a local file to preview'}
                </Typography>
            </div>
            {previewError && (
                <Typography color="error" className={classes.note}>
                    {previewError}
                </Typography>
            )}
        </div>
    );
};
