import { createWorker, setLogging } from '@ffmpeg/ffmpeg';
import { CodecFamily } from '../interfaces/netmd';
import { getPublicPathFor } from '../../utils';
import { DspParams, LoudnormMeasurement, buildMeasureChain, buildRenderChain, hasDsp, parseLoudnormJson } from './dsp';

export interface LogPayload {
    message: string;
    action: string;
}

export type ExportParams = {
    format: { bitrate: number; codec: 'AT3' | 'A3+' | 'PCM' | 'MP3' };
    enableReplayGain?: boolean;
    writeGapless: boolean;
    /** Pre-encode EQ / loudness. Ignored by encoders where supportsDsp() is false. */
    dsp?: DspParams;
};

export interface AudioExportService {
    init(): Promise<void>;
    export(params: ExportParams, callback: (obj: { state: number; total: number }) => void): Promise<ArrayBuffer>;
    info(): Promise<{ format: string | null; input: string | null }>;
    prepare(file: File): Promise<void>;

    getSupport(codec: CodecFamily): { state: 'perfect' | 'mediocre' | 'unsupported'; gapless: boolean };
    /** Whether EQ / loudness can be applied before encoding to this codec. */
    supportsDsp(codec: CodecFamily): boolean;
}

export abstract class DefaultFfmpegAudioExportService implements AudioExportService {
    public ffmpegProcess?: ReturnType<typeof createWorker>;
    public loglines: { action: string; message: string }[] = [];
    public inFileName: string = ``;
    public outFileNameNoExt: string = ``;
    private loudnormMeasurement?: LoudnormMeasurement | null;

    async init() {
        setLogging(true);
    }

    async prepare(file: File) {
        this.loglines = [];
        await this.loadFfmpeg();

        const ext = file.name.split('.').slice(-1);
        if (ext.length === 0) {
            throw new Error(`Unrecognized file format: ${file.name}`);
        }

        this.inFileName = `inAudioFile.${ext[0]}`;
        this.outFileNameNoExt = `outAudioFile`;

        await this.ffmpegProcess.write(this.inFileName, file);
    }

    async loadFfmpeg() {
        this.ffmpegProcess = createWorker({
            logger: (payload: LogPayload) => {
                this.loglines.push(payload);
                console.log(payload.action, payload.message);
            },
            corePath: getPublicPathFor('ffmpeg-core.js'),
            workerPath: getPublicPathFor('worker.min.js'),
        });
        await this.ffmpegProcess.load();
    }

    async volumeDetect() {
        await this.ffmpegProcess.transcode(this.inFileName, 'null', `-af volumedetect -f null`);

        const maxVolumeRegex = /max_volume: ((-)?[\d]*\.[\d]*) dB/;
        let maxVolume;

        for (const line of this.loglines) {
            const match = line.message.match(maxVolumeRegex);
            if (match !== null) {
                maxVolume = parseFloat(match[1]);
            }
        }
        this.loglines = [];
        return maxVolume ?? 0;
    }

    async info() {
        await this.ffmpegProcess.transcode(this.inFileName, `${this.outFileNameNoExt}.metadata`, `-f ffmetadata`);

        const audioFormatRegex = /Audio:\s(.*?),/; // Actual content
        const inputFormatRegex = /Input #0,\s(.*?),/; // Container
        let format: string | null = null;
        let input: string | null = null;

        for (const line of this.loglines) {
            let match = line.message.match(audioFormatRegex);
            if (match !== null) {
                format = match[1];
                continue;
            }
            match = line.message.match(inputFormatRegex);
            if (match !== null) {
                input = match[1];
                continue;
            }
            if (format !== null && input !== null) {
                break;
            }
        }

        return { format, input };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    supportsDsp(_codec: CodecFamily): boolean {
        // Every encoder that builds its command via createFfmpegParams() gets DSP for free.
        return true;
    }

    /**
     * External encoders (remote server, desktop bridge) receive the source file.
     * When DSP is active, render it through ffmpeg to 16-bit WAV first so they get the processed audio.
     */
    async getSourceForExternalEncoder(parameters: ExportParams, originalName: string): Promise<{ data: Uint8Array; name: string }> {
        const dspChain = hasDsp(parameters.dsp) ? buildRenderChain(parameters.dsp, this.loudnormMeasurement ?? undefined) : null;
        if (!dspChain) {
            const { data } = await this.ffmpegProcess.read(this.inFileName);
            return { data, name: originalName };
        }
        const outName = `${this.outFileNameNoExt}.dsp.wav`;
        await this.ffmpegProcess.transcode(this.inFileName, outName, `-af ${dspChain} -ac 2 -ar 44100 -c:a pcm_s16le -f wav`);
        const { data } = await this.ffmpegProcess.read(outName);
        return { data, name: originalName.replace(/\.[^.]*$/, '') + '.wav' };
    }

    /** First pass of two-pass loudnorm: measure the (post-EQ) programme loudness. */
    async measureLoudness(dsp: DspParams): Promise<LoudnormMeasurement | null> {
        const chain = buildMeasureChain(dsp);
        if (!chain) return null;
        this.loglines = [];
        await this.ffmpegProcess.transcode(this.inFileName, 'null', `-af ${chain} -ac 2 -ar 44100 -f null`);
        const measured = parseLoudnormJson(this.loglines.map((l) => l.message).join('\n'));
        this.loglines = [];
        return measured;
    }

    async createFfmpegParams(parameters: ExportParams, outputFormat: string, moreParams?: string) {
        const { enableReplayGain, dsp } = parameters;
        let additionalCommands = '';
        const commonFormatting = `-ac 2 -ar 44100`;
        const dspChain = hasDsp(dsp) ? buildRenderChain(dsp, this.loudnormMeasurement ?? undefined) : null;
        if (dspChain) {
            // DSP supersedes ReplayGain - the UI never enables both.
            additionalCommands += `-af ${dspChain}`;
        } else if (enableReplayGain) {
            additionalCommands += `-af volume=replaygain=track`;
        }
        return `${additionalCommands} ${commonFormatting} ${moreParams ?? ''} -f ${outputFormat}`;
    }

    async export(parameters: ExportParams, callback?: (obj: { state: number; total: number }) => void) {
        const { format } = parameters;
        this.loudnormMeasurement = null;
        if (hasDsp(parameters.dsp) && parameters.dsp.loudness && this.supportsDsp(format.codec as CodecFamily)) {
            // If measurement fails (e.g. silent track) loudnorm falls back to its single-pass dynamic mode.
            this.loudnormMeasurement = await this.measureLoudness(parameters.dsp);
        }
        let result: ArrayBuffer;
        if (format.codec === `PCM`) {
            result = await this.encodePCM(parameters);
        } else if (format.codec === 'AT3') {
            result = await this.encodeATRAC3(parameters, callback);
        } else if (format.codec === 'MP3') {
            result = await this.encodeMP3(parameters);
        } else if (format.codec === 'A3+') {
            result = await this.encodeATRAC3Plus(parameters, callback);
        } else throw new Error('Invalid format');
        this.ffmpegProcess?.worker.terminate();
        return result;
    }

    async encodePCM(parameters: ExportParams): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(parameters, 's16be');
        const outFileName = `${this.outFileNameNoExt}.raw`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = await this.ffmpegProcess.read(outFileName);
        return data.buffer;
    }

    async encodeMP3(parameters: ExportParams): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(
            parameters,
            'mp3',
            `-map 0:a:0 -c:a libmp3lame -b:a ${parameters.format.bitrate!}k`
        );
        const outFileName = `${this.outFileNameNoExt}.mp3`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = await this.ffmpegProcess.read(outFileName);
        return data.buffer;
    }

    abstract encodeATRAC3(parameters: ExportParams, callback?: (obj: { state: number; total: number }) => void): Promise<ArrayBuffer>;
    abstract encodeATRAC3Plus(parameters: ExportParams, callback?: (obj: { state: number; total: number }) => void): Promise<ArrayBuffer>;
    abstract getSupport(codec: CodecFamily): { state: 'perfect' | 'mediocre' | 'unsupported'; gapless: boolean };
}
