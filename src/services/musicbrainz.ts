// Minimal MusicBrainz / Cover Art Archive client for the Label Bay.
//
// MusicBrainz asks clients to stay at or below ~1 request per second per IP and to identify
// themselves. Browsers do not allow setting User-Agent from fetch(), so we compensate by
// throttling strictly and caching every response for the session.

const MB_ROOT = 'https://musicbrainz.org/ws/2';
const CAA_ROOT = 'https://coverartarchive.org';
const MIN_INTERVAL_MS = 1100;

export interface MbRelease {
    id: string;
    title: string;
    artist: string;
    date: string;
    country: string;
    trackCount: number;
    hasFrontArt: boolean | null; // null = unknown from search result
}

let lastCall = 0;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, unknown>();

function throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
        const wait = lastCall + MIN_INTERVAL_MS - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastCall = Date.now();
        return fn();
    });
    queue = run.catch(() => undefined);
    return run;
}

async function mbGet<T>(path: string): Promise<T> {
    const url = `${MB_ROOT}${path}${path.includes('?') ? '&' : '?'}fmt=json`;
    if (cache.has(url)) return cache.get(url) as T;
    const res = await throttled(() => fetch(url, { headers: { Accept: 'application/json' } }));
    if (res.status === 503) throw new Error('MusicBrainz is rate-limiting requests. Wait a few seconds and try again.');
    if (!res.ok) throw new Error(`MusicBrainz returned HTTP ${res.status}`);
    const json = (await res.json()) as T;
    cache.set(url, json);
    return json;
}

const esc = (s: string) => s.replace(/(["\\])/g, '\\$1');

export async function searchReleases(album: string, artist: string): Promise<MbRelease[]> {
    const parts: string[] = [];
    if (album.trim()) parts.push(`release:"${esc(album.trim())}"`);
    if (artist.trim()) parts.push(`artist:"${esc(artist.trim())}"`);
    if (parts.length === 0) return [];
    const q = encodeURIComponent(parts.join(' AND '));
    const json = await mbGet<any>(`/release/?query=${q}&limit=8`);
    return (json.releases ?? []).map(
        (r: any): MbRelease => ({
            id: r.id,
            title: r.title ?? '',
            artist: (r['artist-credit'] ?? []).map((c: any) => (c.name ?? c.artist?.name ?? '') + (c.joinphrase ?? '')).join(''),
            date: r.date ?? '',
            country: r.country ?? '',
            trackCount: r['track-count'] ?? 0,
            hasFrontArt: r['cover-art-archive'] ? !!r['cover-art-archive'].front : null,
        })
    );
}

export async function getReleaseTracklist(mbid: string): Promise<string[]> {
    const json = await mbGet<any>(`/release/${mbid}?inc=recordings`);
    const out: string[] = [];
    for (const medium of json.media ?? []) {
        for (const t of medium.tracks ?? []) out.push(t.title ?? '');
    }
    return out;
}

/**
 * Fetch front cover as a Blob. Using fetch()+blob (instead of <img src>) keeps the export canvas
 * untainted, as long as the CAA / archive.org redirect chain sends CORS headers.
 */
export async function fetchFrontCover(mbid: string, size: 250 | 500 | 1200 = 500): Promise<Blob> {
    const res = await fetch(`${CAA_ROOT}/release/${mbid}/front-${size}`, { mode: 'cors' });
    if (res.status === 404) throw new Error('This release has no front cover in the Cover Art Archive.');
    if (!res.ok) throw new Error(`Cover Art Archive returned HTTP ${res.status}`);
    return await res.blob();
}
