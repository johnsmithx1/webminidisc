import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import { savePreference, loadPreference } from '../utils';
import type { DspParams } from '../services/audio/dsp';

// Winamp-style 10-band layout.
export const EQ_BANDS_HZ = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
export const EQ_BAND_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
export const EQ_RANGE_DB = 12;

export interface EqPreset {
    id: string;
    name: string;
    gains: number[];
    preamp: number;
}

export const EQ_PRESETS: EqPreset[] = [
    { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0 },
    { id: 'mdloud', name: 'MD Loudness', gains: [5, 3.5, 1, 0, -1, 0, 1, 3, 4, 4], preamp: -5 },
    { id: 'bass', name: 'Bass Drive', gains: [7, 5.5, 2, 0, 0, 0, 0, 0, 0, 0], preamp: -7 },
    { id: 'vocal', name: 'Vocal Forward', gains: [-2, -1, 0, 1.5, 3, 4, 3, 1, 0, -1], preamp: -4 },
    { id: 'cabin', name: 'Car Cabin', gains: [3, 2, 0, -1, -1.5, 1, 2, 3, 2, 1], preamp: -3 },
    { id: 'lp4', name: 'LP4 Prep (experimental)', gains: [1, 1, 0, 0, 0, 1, 1, -1, -4, -6], preamp: -1 },
];

export const LOUDNESS_TARGETS: (number | null)[] = [null, -14, -16, -18, -23];

export interface DspFeature {
    eqEnabled: boolean;
    eqPreset: string; // preset id, or 'custom'
    eqGains: number[];
    eqPreamp: number;
    eqAutoGain: boolean;
    loudnessTarget: number | null; // integrated LUFS, null = off
    loudnessTruePeak: number; // dBTP ceiling
}

const flat = EQ_PRESETS[0];

export const buildInitialState = (): DspFeature => ({
    eqEnabled: loadPreference('dspEqEnabled', false) as boolean,
    eqPreset: loadPreference('dspEqPreset', flat.id) as string,
    eqGains: loadPreference('dspEqGains', flat.gains) as number[],
    eqPreamp: loadPreference('dspEqPreamp', 0) as number,
    eqAutoGain: loadPreference('dspEqAutoGain', true) as boolean,
    loudnessTarget: loadPreference('dspLoudnessTarget', null) as number | null,
    loudnessTruePeak: -1,
});

const persist = (s: DspFeature) => {
    savePreference('dspEqEnabled', s.eqEnabled);
    savePreference('dspEqPreset', s.eqPreset);
    savePreference('dspEqGains', s.eqGains);
    savePreference('dspEqPreamp', s.eqPreamp);
    savePreference('dspEqAutoGain', s.eqAutoGain);
    savePreference('dspLoudnessTarget', s.loudnessTarget);
};

const slice = createSlice({
    name: 'dsp',
    initialState: buildInitialState(),
    reducers: {
        setEqEnabled: (state, action: PayloadAction<boolean>) => {
            state.eqEnabled = action.payload;
            persist(state);
        },
        setEqBand: (state, action: PayloadAction<{ index: number; gain: number }>) => {
            state.eqGains[action.payload.index] = action.payload.gain;
            state.eqPreset = 'custom';
            persist(state);
        },
        setEqPreamp: (state, action: PayloadAction<number>) => {
            state.eqPreamp = action.payload;
            state.eqAutoGain = false;
            state.eqPreset = 'custom';
            persist(state);
        },
        setEqAutoGain: (state, action: PayloadAction<boolean>) => {
            state.eqAutoGain = action.payload;
            persist(state);
        },
        applyEqPreset: (state, action: PayloadAction<string>) => {
            const preset = EQ_PRESETS.find((p) => p.id === action.payload);
            if (!preset) return;
            state.eqPreset = preset.id;
            state.eqGains = preset.gains.slice();
            state.eqPreamp = preset.preamp;
            persist(state);
        },
        setLoudnessTarget: (state, action: PayloadAction<number | null>) => {
            state.loudnessTarget = action.payload;
            persist(state);
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);

/** Preamp actually applied: auto-gain pulls the signal down by the largest boost so the EQ cannot clip. */
export function effectivePreamp(s: Pick<DspFeature, 'eqGains' | 'eqPreamp' | 'eqAutoGain'>): number {
    return s.eqAutoGain ? -Math.max(0, ...s.eqGains) : s.eqPreamp;
}

export function isDspActive(s: DspFeature): boolean {
    return (s.eqEnabled && s.eqGains.some((g) => g !== 0)) || s.loudnessTarget !== null;
}

/** Redux DSP state -> encoder parameters. Returns undefined when nothing would change the audio. */
export function buildDspParams(s: DspFeature): DspParams | undefined {
    const eqActive = s.eqEnabled && s.eqGains.some((g) => g !== 0);
    const out: DspParams = {};
    if (eqActive) {
        out.eq = { preamp: effectivePreamp(s), bands: EQ_BANDS_HZ.map((f, i) => ({ f, g: s.eqGains[i] })) };
    }
    if (s.loudnessTarget !== null) {
        out.loudness = { I: s.loudnessTarget, TP: s.loudnessTruePeak, LRA: 11 };
    }
    return out.eq || out.loudness ? out : undefined;
}
