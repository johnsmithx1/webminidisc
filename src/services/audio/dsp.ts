// Pre-encode DSP for Web MiniDisc Pro (MD Studio fork).
//
// Everything here becomes an ffmpeg `-af` filter string. The bundled ffmpeg-core
// ships `volume`, `equalizer` and `loudnorm`, so no extra DSP code runs in JS.
//
// NOTE: @ffmpeg/ffmpeg 0.6.1 splits its argument string on spaces, so filter
// strings must never contain a space.

export interface EqParams {
    preamp: number; // dB
    bands: { f: number; g: number }[]; // Hz, dB
}

export interface LoudnessParams {
    I: number; // integrated target, LUFS
    TP: number; // true-peak ceiling, dBTP
    LRA: number; // loudness range target, LU
}

export interface LoudnormMeasurement {
    input_i: string;
    input_tp: string;
    input_lra: string;
    input_thresh: string;
    target_offset: string;
}

export interface DspParams {
    eq?: EqParams;
    loudness?: LoudnessParams;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

export function buildEqFilters(eq?: EqParams): string[] {
    if (!eq) return [];
    const active = eq.bands.filter((b) => b.g !== 0);
    if (active.length === 0 && eq.preamp === 0) return [];
    const out: string[] = [];
    if (eq.preamp !== 0) out.push(`volume=${n(eq.preamp)}dB`);
    for (const b of active) {
        // Peaking biquad, Q=1.4 — roughly one octave, matches the Web Audio preview.
        out.push(`equalizer=f=${b.f}:t=q:w=1.4:g=${n(b.g)}`);
    }
    return out;
}

export function buildLoudnormFilter(l: LoudnessParams, measured?: LoudnormMeasurement): string {
    const base = `loudnorm=I=${n(l.I)}:TP=${n(l.TP)}:LRA=${n(l.LRA)}`;
    if (!measured) return `${base}:print_format=json`;
    return (
        `${base}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
        `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
        `:offset=${measured.target_offset}:linear=true`
    );
}

/** Filters for the measurement pass (EQ first, so loudness is measured post-EQ). */
export function buildMeasureChain(dsp: DspParams): string | null {
    if (!dsp.loudness) return null;
    return [...buildEqFilters(dsp.eq), buildLoudnormFilter(dsp.loudness)].join(',');
}

/** Filters for the real encode. */
export function buildRenderChain(dsp: DspParams, measured?: LoudnormMeasurement): string | null {
    const chain = buildEqFilters(dsp.eq);
    if (dsp.loudness) chain.push(buildLoudnormFilter(dsp.loudness, measured));
    return chain.length ? chain.join(',') : null;
}

export function hasDsp(dsp?: DspParams): dsp is DspParams {
    return !!dsp && (buildEqFilters(dsp.eq).length > 0 || !!dsp.loudness);
}

/** loudnorm prints a JSON object across several log lines; pull it back out. */
export function parseLoudnormJson(log: string): LoudnormMeasurement | null {
    const start = log.lastIndexOf('"input_i"');
    if (start < 0) return null;
    const open = log.lastIndexOf('{', start);
    const close = log.indexOf('}', start);
    if (open < 0 || close < 0) return null;
    try {
        const obj = JSON.parse(log.substring(open, close + 1));
        const keys: (keyof LoudnormMeasurement)[] = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'];
        for (const k of keys) {
            const v = parseFloat(obj[k]);
            // Silent input yields -inf; linear mode cannot use it.
            if (!isFinite(v)) return null;
        }
        return obj as LoudnormMeasurement;
    } catch (e) {
        return null;
    }
}
