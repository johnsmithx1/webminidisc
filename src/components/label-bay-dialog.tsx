import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import { useDispatch, useShallowEqualSelector } from '../frontend-utils';
import { actions as labelBayActions } from '../redux/label-bay-feature';
import { getSortedTracks } from '../utils';
import { MbRelease, fetchFrontCover, getReleaseTracklist, searchReleases } from '../services/musicbrainz';

// ---- Physical dimensions (mm) --------------------------------------------------------------
// J-card for the blank-disc case: 73 mm tall, 68 mm front, 5.5 mm spine, 11 mm rear tab.
const JCARD = { h: 73, front: 68, spine: 5.5, tab: 11 };
// Disc face sticker: stocks vary. Defaults are a starting point - measure yours and adjust.
const DEFAULT_FACE = { w: 38, h: 53 };
const DPI = 300;
const PX = DPI / 25.4;
const MARGIN = 8;
const GAP = 10;

const TINTS = [
    { id: 'paper', name: 'Paper white', hex: '#F4F2EC' },
    { id: 'mint', name: 'Phosphor mint', hex: '#CFE9C9' },
    { id: 'signal', name: 'Signal yellow', hex: '#F3F5C8' },
    { id: 'lavender', name: 'DSP lavender', hex: '#DCD0F2' },
];

type Layout = 'art' | 'toc' | 'type';

interface LabelSpec {
    album: string;
    artist: string;
    year: string;
    tracks: string[];
    art: ImageBitmap | null;
    layout: Layout;
    tint: string;
    faceW: number;
    faceH: number;
}

const DISPLAY = "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, Menlo, monospace";
const INK = '#141414';
const RING_COLORS = ['#87EF7E', '#D8FFCD', '#AD89F0', '#F6FFBF', '#3A6B37', '#6B55A0'];

function hash(s: string) {
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
}

function sheetSize(spec: LabelSpec) {
    const w = MARGIN + spec.faceW + GAP + JCARD.front + JCARD.spine + JCARD.tab + MARGIN;
    const h = MARGIN + Math.max(spec.faceH, JCARD.h) + MARGIN + 6;
    return { w, h };
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, sizePx: number, weight: string, family: string, minPx = 6) {
    let size = sizePx;
    g.font = `${weight} ${size}px ${family}`;
    while (g.measureText(text).width > maxW && size > minPx) {
        size -= 1;
        g.font = `${weight} ${size}px ${family}`;
    }
    if (g.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
}

function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (g.measureText(next).width <= maxW || !cur) cur = next;
        else {
            lines.push(cur);
            cur = w;
        }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = kept[maxLines - 1] + '…';
        return kept;
    }
    return lines;
}

function drawCover(g: CanvasRenderingContext2D, spec: LabelSpec, x: number, y: number, w: number, h: number) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    if (spec.art) {
        const a = spec.art;
        const scale = Math.max(w / a.width, h / a.height);
        const sw = w / scale;
        const sh = h / scale;
        g.drawImage(a, (a.width - sw) / 2, (a.height - sh) / 2, sw, sh, x, y, w, h);
    } else {
        // Generative placeholder derived from album + artist.
        g.fillStyle = '#101214';
        g.fillRect(x, y, w, h);
        const seed = hash(spec.album + spec.artist);
        const s = Math.min(w, h);
        for (let i = 0; i < 8; i++) {
            const k = (seed >> (i * 3)) & 7;
            g.strokeStyle = RING_COLORS[(k + i) % RING_COLORS.length];
            g.lineWidth = s * (0.006 + (k % 3) * 0.008);
            g.beginPath();
            g.arc(x + w * (0.35 + (k % 4) * 0.1), y + h * (0.4 + (k % 3) * 0.08), s * (0.08 + i * 0.07), 0, Math.PI * 2);
            g.stroke();
        }
    }
    g.restore();
}

function cropMarks(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const L = 3 * PX;
    const o = 1 * PX;
    g.save();
    g.strokeStyle = '#8E9097';
    g.lineWidth = 0.15 * PX;
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
    };
    for (const [cx, cy, dx, dy] of [
        [x, y, -1, -1],
        [x + w, y, 1, -1],
        [x, y + h, -1, 1],
        [x + w, y + h, 1, 1],
    ]) {
        seg(cx + dx * o, cy, cx + dx * (o + L), cy);
        seg(cx, cy + dy * o, cx, cy + dy * (o + L));
    }
    g.restore();
}

function renderSheet(canvas: HTMLCanvasElement, spec: LabelSpec) {
    const { w, h } = sheetSize(spec);
    canvas.width = Math.round(w * PX);
    canvas.height = Math.round(h * PX);
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.textBaseline = 'alphabetic';

    const albumU = spec.album || 'Untitled';
    const metaLine = [spec.artist, spec.year].filter(Boolean).join(' · ');

    // ---- Disc face sticker ----
    const fx = MARGIN * PX;
    const fy = MARGIN * PX;
    const fw = spec.faceW * PX;
    const fh = spec.faceH * PX;
    const pad = 2 * PX;
    g.fillStyle = spec.tint;
    g.beginPath();
    (g as any).roundRect ? (g as any).roundRect(fx, fy, fw, fh, 1.5 * PX) : g.rect(fx, fy, fw, fh);
    g.fill();
    cropMarks(g, fx, fy, fw, fh);

    let cursor = fy + pad;
    const innerW = fw - pad * 2;
    if (spec.layout !== 'type') {
        const artH = spec.layout === 'toc' ? Math.min(innerW * 0.62, fh * 0.42) : Math.min(innerW, fh * 0.64);
        drawCover(g, spec, fx + pad, cursor, innerW, artH);
        cursor += artH + 2.4 * PX;
    } else {
        cursor += 2 * PX;
    }

    g.fillStyle = INK;
    if (spec.layout === 'type') {
        g.font = `700 ${Math.round(5.2 * PX)}px ${DISPLAY}`;
        for (const line of wrapLines(g, albumU, innerW, 3)) {
            cursor += 5.2 * PX;
            g.fillText(line, fx + pad, cursor);
        }
    } else {
        const t = fitText(g, albumU, innerW, Math.round(3.4 * PX), '700', DISPLAY, Math.round(2 * PX));
        cursor += 3.2 * PX;
        g.fillText(t, fx + pad, cursor);
    }
    g.fillStyle = '#3B3D42';
    const m = fitText(g, metaLine.toUpperCase(), innerW, Math.round(1.8 * PX), '500', MONO, Math.round(1.2 * PX));
    cursor += 2.6 * PX;
    g.fillText(m, fx + pad, cursor);

    if (spec.layout !== 'art' && spec.tracks.length) {
        cursor += 1.4 * PX;
        g.strokeStyle = 'rgba(20,20,20,0.25)';
        g.lineWidth = 0.15 * PX;
        g.beginPath();
        g.moveTo(fx + pad, cursor);
        g.lineTo(fx + fw - pad, cursor);
        g.stroke();
        const footer = fy + fh - 3.4 * PX;
        const lineH = 1.75 * PX;
        const rows = Math.max(1, Math.floor((footer - cursor - 1 * PX) / lineH));
        const cols = spec.tracks.length > rows ? 2 : 1;
        const colW = (innerW - (cols - 1) * 1.5 * PX) / cols;
        g.fillStyle = '#2A2C30';
        spec.tracks.slice(0, rows * cols).forEach((title, i) => {
            const col = Math.floor(i / rows);
            const row = i % rows;
            const label = `${String(i + 1).padStart(2, '0')} ${title}`;
            const t = fitText(g, label, colW, Math.round(1.3 * PX), '400', MONO, Math.round(1.1 * PX));
            g.fillText(t, fx + pad + col * (colW + 1.5 * PX), cursor + (row + 1) * lineH);
        });
    }
    // Face footer
    g.fillStyle = '#55575C';
    g.font = `500 ${Math.round(1.2 * PX)}px ${MONO}`;
    g.fillText('MINIDISC · ATRAC', fx + pad, fy + fh - 1.6 * PX);

    // ---- J-card (flat): front | spine | rear tab ----
    const jx = fx + fw + GAP * PX;
    const jy = fy;
    const jh = JCARD.h * PX;
    const frontW = JCARD.front * PX;
    const spineW = JCARD.spine * PX;
    const tabW = JCARD.tab * PX;

    drawCover(g, spec, jx, jy, frontW, jh);
    // Legibility band at the bottom of the front panel.
    g.fillStyle = 'rgba(16,18,20,0.72)';
    g.fillRect(jx, jy + jh - 14 * PX, frontW, 14 * PX);
    g.fillStyle = '#F2F2F4';
    g.fillText(fitText(g, albumU, frontW - 8 * PX, Math.round(5 * PX), '700', DISPLAY, Math.round(3 * PX)), jx + 4 * PX, jy + jh - 7 * PX);
    g.fillStyle = '#87EF7E';
    g.fillText(
        fitText(g, metaLine.toUpperCase(), frontW - 8 * PX, Math.round(2 * PX), '500', MONO, Math.round(1.3 * PX)),
        jx + 4 * PX,
        jy + jh - 3 * PX
    );

    g.fillStyle = spec.tint;
    g.fillRect(jx + frontW, jy, spineW + tabW, jh);
    // Spine text, reading bottom-to-top.
    g.save();
    g.translate(jx + frontW + spineW / 2, jy + jh / 2);
    g.rotate(-Math.PI / 2);
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const spineText = [spec.artist, albumU, spec.year].filter(Boolean).join('  //  ').toUpperCase();
    g.fillText(fitText(g, spineText, jh - 4 * PX, Math.round(2.4 * PX), '700', MONO, Math.round(1.4 * PX)), 0, 0);
    g.restore();
    // Rear tab
    g.fillStyle = '#3B3D42';
    g.font = `500 ${Math.round(1.4 * PX)}px ${MONO}`;
    ['NETMD', spec.year].filter(Boolean).forEach((t, i) => g.fillText(t, jx + frontW + spineW + 1.5 * PX, jy + (4 + i * 2.2) * PX));

    // Fold lines + crop marks
    g.save();
    g.strokeStyle = 'rgba(20,20,20,0.35)';
    g.lineWidth = 0.15 * PX;
    g.setLineDash([1 * PX, 1 * PX]);
    for (const x of [jx + frontW, jx + frontW + spineW]) {
        g.beginPath();
        g.moveTo(x, jy);
        g.lineTo(x, jy + jh);
        g.stroke();
    }
    g.restore();
    cropMarks(g, jx, jy, frontW + spineW + tabW, jh);

    // Sheet caption
    g.fillStyle = '#8E9097';
    g.font = `400 ${Math.round(1.6 * PX)}px ${MONO}`;
    g.textAlign = 'left';
    g.fillText(
        `FACE ${spec.faceW}×${spec.faceH} MM · J-CARD ${JCARD.front}+${JCARD.spine}+${JCARD.tab}×${JCARD.h} MM · PRINT AT 100% (NO FIT-TO-PAGE)`,
        MARGIN * PX,
        (h - 3) * PX
    );
}

const useStyles = makeStyles()((theme) => ({
    content: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)',
        gap: theme.spacing(2),
        [theme.breakpoints.down('md')]: {
            gridTemplateColumns: 'minmax(0, 1fr)',
        },
    },
    controls: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1.5),
    },
    row: {
        display: 'flex',
        gap: theme.spacing(1),
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    preview: {
        background: '#D9D7D2',
        borderRadius: 4,
        padding: theme.spacing(1.5),
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflow: 'auto',
    },
    canvas: {
        width: '100%',
        height: 'auto',
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        background: '#fff',
    },
    results: {
        maxHeight: 180,
        overflow: 'auto',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 4,
    },
    swatch: {
        width: 36,
        height: 36,
        borderRadius: 4,
        cursor: 'pointer',
        border: '2px solid transparent',
    },
    swatchActive: {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 8px ${theme.palette.primary.main}`,
    },
    small: {
        fontSize: '0.75rem',
    },
    hiddenInput: {
        display: 'none',
    },
}));

export const LabelBayDialog = () => {
    const { classes, cx } = useStyles();
    const dispatch = useDispatch();
    const visible = useShallowEqualSelector((state) => state.labelBay.visible);
    const disc = useShallowEqualSelector((state) => state.main.disc);

    const discTracks = useMemo(() => (disc ? getSortedTracks(disc).map((t) => t.fullWidthTitle || t.title || '') : []), [disc]);

    const [album, setAlbum] = useState('');
    const [artist, setArtist] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [tracks, setTracks] = useState<string[]>([]);
    const [art, setArt] = useState<ImageBitmap | null>(null);
    const [layout, setLayout] = useState<Layout>('toc');
    const [tint, setTint] = useState(TINTS[0].hex);
    const [faceW, setFaceW] = useState(DEFAULT_FACE.w);
    const [faceH, setFaceH] = useState(DEFAULT_FACE.h);

    const [results, setResults] = useState<MbRelease[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [fontsReady, setFontsReady] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Seed from the disc in the drive whenever the dialog opens.
    useEffect(() => {
        if (!visible) return;
        setAlbum(disc?.fullWidthTitle || disc?.title || '');
        setTracks(discTracks);
        setResults(null);
        setMessage(null);
    }, [visible, disc, discTracks]);

    useEffect(() => {
        if (!visible) return;
        Promise.all([
            document.fonts.load(`700 40px 'Space Grotesk'`),
            document.fonts.load(`500 40px 'Geist Mono'`),
            document.fonts.load(`400 40px 'Geist Mono'`),
        ])
            .catch(() => undefined)
            .finally(() => setFontsReady(true));
    }, [visible]);

    const spec: LabelSpec = useMemo(
        () => ({ album, artist, year, tracks, art, layout, tint, faceW, faceH }),
        [album, artist, year, tracks, art, layout, tint, faceW, faceH]
    );

    useEffect(() => {
        if (visible && fontsReady && canvasRef.current) renderSheet(canvasRef.current, spec);
    }, [visible, fontsReady, spec]);

    const handleClose = useCallback(() => dispatch(labelBayActions.setVisible(false)), [dispatch]);

    const handleSearch = useCallback(async () => {
        setBusy(true);
        setMessage(null);
        try {
            const r = await searchReleases(album, artist);
            setResults(r);
            if (r.length === 0) setMessage('No matching releases. Check the spelling, or upload artwork instead.');
        } catch (e: any) {
            setMessage(e?.message ?? 'MusicBrainz lookup failed.');
        } finally {
            setBusy(false);
        }
    }, [album, artist]);

    const handlePickRelease = useCallback(async (r: MbRelease) => {
        setBusy(true);
        setMessage(null);
        setAlbum(r.title);
        setArtist(r.artist);
        if (r.date) setYear(r.date.slice(0, 4));
        try {
            const list = await getReleaseTracklist(r.id);
            if (list.length) setTracks(list);
        } catch (e) {
            // Keep the disc's own track titles.
        }
        try {
            const blob = await fetchFrontCover(r.id, 1200);
            setArt(await createImageBitmap(blob));
        } catch (e: any) {
            setMessage(`${e?.message ?? 'Could not load cover art.'} You can upload artwork instead.`);
        } finally {
            setBusy(false);
        }
    }, []);

    const handleUpload = useCallback(async (ev: React.ChangeEvent<HTMLInputElement>) => {
        const file = ev.target.files?.[0];
        ev.target.value = '';
        if (!file) return;
        try {
            const bmp = await createImageBitmap(file);
            if (Math.min(bmp.width, bmp.height) < 500) setMessage('Heads up: artwork under 500 px will print soft at 300 DPI.');
            else setMessage(null);
            setArt(bmp);
        } catch (e) {
            setMessage('That file could not be read as an image.');
        }
    }, []);

    const fileBase = (album || 'minidisc-label')
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '-');

    const handleDownload = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileBase}-label-300dpi.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            }, 'image/png');
        } catch (e) {
            setMessage('Export blocked by the browser (cross-origin artwork). Upload the artwork file instead.');
        }
    }, [fileBase]);

    const handlePrint = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let dataUrl: string;
        try {
            dataUrl = canvas.toDataURL('image/png');
        } catch (e) {
            setMessage('Export blocked by the browser (cross-origin artwork). Upload the artwork file instead.');
            return;
        }
        const { w } = sheetSize(spec);
        const win = window.open('', '_blank');
        if (!win) {
            setMessage('Pop-up blocked. Use "Download PNG" and print it at 100% scale.');
            return;
        }
        win.document.write(
            `<!doctype html><title>${fileBase}</title><style>@page{margin:10mm}body{margin:0}img{width:${w}mm;height:auto}</style>` +
                `<img src="${dataUrl}" onload="setTimeout(function(){window.print()},200)">`
        );
        win.document.close();
    }, [spec, fileBase]);

    return (
        <Dialog open={visible} onClose={handleClose} maxWidth="lg" fullWidth aria-labelledby="label-bay-title">
            <DialogTitle id="label-bay-title">Label Bay</DialogTitle>
            <DialogContent>
                <div className={classes.content}>
                    <div className={classes.controls}>
                        <TextField label="Album" value={album} onChange={(e) => setAlbum(e.target.value)} fullWidth />
                        <div className={classes.row}>
                            <TextField
                                label="Artist"
                                value={artist}
                                onChange={(e) => setArtist(e.target.value)}
                                style={{ flex: '1 1 0' }}
                            />
                            <TextField label="Year" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 72 }} />
                        </div>
                        <div className={classes.row}>
                            <Button variant="outlined" size="small" onClick={handleSearch} disabled={busy || (!album && !artist)}>
                                Find on MusicBrainz
                            </Button>
                            <Button size="small" onClick={() => fileInputRef.current?.click()}>
                                Upload art
                            </Button>
                            {art && (
                                <Button size="small" onClick={() => setArt(null)}>
                                    Clear art
                                </Button>
                            )}
                            {busy && <CircularProgress size={18} />}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className={classes.hiddenInput}
                                onChange={handleUpload}
                            />
                        </div>
                        {results && results.length > 0 && (
                            <List dense disablePadding className={classes.results}>
                                {results.map((r) => (
                                    <ListItemButton key={r.id} onClick={() => handlePickRelease(r)} disabled={busy}>
                                        <ListItemText
                                            primary={`${r.title} — ${r.artist}`}
                                            secondary={[
                                                r.date,
                                                r.country,
                                                r.trackCount ? `${r.trackCount} trk` : '',
                                                r.hasFrontArt === false ? 'no art' : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                        )}
                        {message && (
                            <Typography color="warning.main" className={classes.small}>
                                {message}
                            </Typography>
                        )}
                        <Typography variant="caption" color="textSecondary">
                            Layout
                        </Typography>
                        <ToggleButtonGroup size="small" exclusive value={layout} onChange={(_e, v) => v && setLayout(v)}>
                            <ToggleButton value="art">Art</ToggleButton>
                            <ToggleButton value="toc">Art + TOC</ToggleButton>
                            <ToggleButton value="type">Type only</ToggleButton>
                        </ToggleButtonGroup>
                        <Typography variant="caption" color="textSecondary">
                            Sticker stock
                        </Typography>
                        <div className={classes.row}>
                            {TINTS.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    aria-label={t.name}
                                    aria-pressed={tint === t.hex}
                                    title={t.name}
                                    className={cx(classes.swatch, { [classes.swatchActive]: tint === t.hex })}
                                    style={{ background: t.hex }}
                                    onClick={() => setTint(t.hex)}
                                />
                            ))}
                        </div>
                        <Typography variant="caption" color="textSecondary">
                            Face sticker size (mm) — measure your stock
                        </Typography>
                        <div className={classes.row}>
                            <TextField
                                label="Width"
                                type="number"
                                value={faceW}
                                onChange={(e) => setFaceW(Math.max(20, Math.min(70, parseFloat(e.target.value) || DEFAULT_FACE.w)))}
                                style={{ width: 90 }}
                            />
                            <TextField
                                label="Height"
                                type="number"
                                value={faceH}
                                onChange={(e) => setFaceH(Math.max(20, Math.min(72, parseFloat(e.target.value) || DEFAULT_FACE.h)))}
                                style={{ width: 90 }}
                            />
                        </div>
                        <Typography color="textSecondary" className={classes.small}>
                            {tracks.length} track titles from {results ? 'MusicBrainz / disc' : 'the disc'}. Cover art: MusicBrainz / Cover
                            Art Archive, or your own upload.
                        </Typography>
                    </div>
                    <div className={classes.preview}>
                        <canvas ref={canvasRef} className={classes.canvas} aria-label="Label sheet preview" />
                    </div>
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
                <Button onClick={handleDownload}>Download PNG (300 DPI)</Button>
                <Button variant="contained" onClick={handlePrint}>
                    Print 1:1
                </Button>
            </DialogActions>
        </Dialog>
    );
};
