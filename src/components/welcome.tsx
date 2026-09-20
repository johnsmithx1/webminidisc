// Studio MD fork workspace changes: 2026-09-19.
import React, { useCallback, useState } from 'react';
import { useDispatch, batchActions } from '../frontend-utils';
import { deleteService, pair } from '../redux/actions';

import { useShallowEqualSelector } from '../frontend-utils';

import { makeStyles } from 'tss-react/mui';
import IconButton from '@mui/material/IconButton';

import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import { TopMenu } from './topmenu';

import SplitButton, { OptionType } from './split-button';
import {
    createService,
    doesServiceRequireChrome,
    getConnectButtonName,
    getServiceSpec,
    getSimpleServices,
    Services,
} from '../services/interface-service-manager';

import { OtherDeviceDialog } from './other-device-dialog';
import { SettingsDialog } from './settings-dialog';
import { ChangelogDialog } from './changelog-dialog';
import { AboutDialog } from './about-dialog';

import { actions as otherDialogActions } from '../redux/other-device-feature';
import { actions as appActions } from '../redux/app-feature';
import { initializeParameters } from '../custom-parameters';

const useStyles = makeStyles()((theme) => ({
    main: {
        position: 'relative',
        flex: '1 1 auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
    },
    buttonBox: {
        marginTop: theme.spacing(3),
        minWidth: 200,
    },
    deleteButton: {
        width: theme.spacing(2),
        height: theme.spacing(2),
        verticalAlign: 'middle',
        marginLeft: theme.spacing(-0.5),
        marginRight: theme.spacing(1.5),
    },
    standardOption: {
        marginLeft: theme.spacing(3),
    },
    spacing: {
        marginTop: theme.spacing(1),
    },
    why: {
        alignSelf: 'flex-start',
        marginTop: theme.spacing(3),
    },
    headBox: {
        display: 'flex',
        justifyContent: 'space-between',
    },
    connectContainer: {
        flex: '1 1 auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
    },
    supportContainer: {
        flex: '1 1 auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
    },
}));

export const Welcome = () => {
    const { classes } = useStyles();
    const dispatch = useDispatch();
    const {
        browserSupported,
        runningChrome,
        availableServices,
        pairingFailed,
        pairingMessage,
        lastSelectedService,
        connectingInProgress,
    } = useShallowEqualSelector((state) => state.appState);
    const simpleServicesLength = getSimpleServices().length;
    if (pairingMessage.toLowerCase().match(/denied/)) {
        // show linux instructions
    }
    // Access denied.

    const deleteCustom = useCallback(
        (event: React.SyntheticEvent, index: number) => {
            event.stopPropagation();
            dispatch(deleteService(index));
        },
        [dispatch]
    );

    const forceContinue = (event: React.SyntheticEvent) => {
        event.preventDefault();
        dispatch(appActions.setBrowserSupported(true));
    };

    const [activeBay, setActiveBay] = useState('deck');
    const [selectedTrack, setSelectedTrack] = useState(3);

    const options: OptionType[] = availableServices.map((n, i) => ({
        name: getConnectButtonName(n),
        switchTo: true,
        handler: () => {
            const instance = createService(availableServices[i]);
            if (instance) {
                dispatch(appActions.setLastSelectedService(i));
                dispatch(pair(instance, getServiceSpec(availableServices[i])!));
            }
        },
        id: i,
        disabled: !runningChrome && doesServiceRequireChrome(availableServices[i]),
    }));

    const firstService = Services.find((n) => n.customParameters);
    if (firstService) {
        options.push({
            name: 'Add Custom Device',
            switchTo: false,
            handler: () =>
                dispatch(
                    batchActions([
                        otherDialogActions.setVisible(true),
                        otherDialogActions.setSelectedServiceIndex(0),
                        otherDialogActions.setCustomParameters(initializeParameters(firstService.customParameters)),
                    ])
                ),
            customAddIcon: true,
        });
    }

    const mapToEntry = (option: OptionType) => {
        return option.id >= simpleServicesLength ? (
            <React.Fragment>
                <IconButton aria-label="delete" className={classes.deleteButton} size="small" onClick={(e) => deleteCustom(e, option.id)}>
                    <DeleteIcon />
                </IconButton>
                {option.name}
            </React.Fragment>
        ) : option.customAddIcon ? (
            <React.Fragment>
                <IconButton aria-label="add custom device" className={classes.deleteButton} size="small">
                    <AddIcon />
                </IconButton>
                {option.name}
            </React.Fragment>
        ) : (
            <span className={classes.standardOption}>{option.name}</span>
        );
    };

    return (
        <React.Fragment>
            <div className="studio-workspace">
                <div className="studio-workspace-toolbar">
                    <div><div className="studio-eyebrow">STUDIO MD / LIVE CONSOLE</div><div className="studio-workspace-title">Your designs, in motion.</div></div>
                    <div className="studio-workspace-toolbar-right">
                        <span className="studio-workspace-clock">{pairingFailed ? pairingMessage : 'NO DECK LINKED'}</span>
                        {browserSupported ? <SplitButton options={options} color="primary" boxClassName="studio-workspace-connect" width={150} disabled={Services[lastSelectedService].requiresChrome && !runningChrome} selectedIndex={lastSelectedService} dropdownMapping={mapToEntry} loading={connectingInProgress} /> : <button type="button" className="studio-workspace-remote" onClick={forceContinue}>REMOTE MODE</button>}
                        <TopMenu />
                    </div>
                </div>
                <nav className="studio-bay-tabs" aria-label="Studio bays">
                    {[['deck', 'MINI DECK'], ['burner', 'BURNER BAY'], ['equalizer', 'DSP EQUALIZER'], ['labels', 'LABEL BAY']].map(([id, label]) => <button type="button" key={id} className={activeBay === id ? 'is-active' : ''} onClick={() => setActiveBay(id)}>{label}</button>)}
                </nav>
                <div className="studio-window-grid">
                    <section className={`studio-window studio-window-deck ${activeBay === 'deck' ? 'is-focused' : ''}`} onClick={() => setActiveBay('deck')}>
                        <div className="studio-window-titlebar"><span><i className="studio-window-led" /> MINI DECK <b>// TOC + TRANSPORT</b></span><span className="studio-window-tools">− □ ×</span></div>
                        <div className="studio-lcd-row"><div><small>DISC NAME</small><strong>NIGHT BUS / TAPE 07</strong></div><div><small>REMAIN</small><strong>23:41 <em>LP2</em></strong></div><div><small>TRACK</small><strong>04 <em>/ 08</em></strong></div></div>
                        <div className="studio-track-table"><div className="studio-track-head"><span>#</span><span>TITLE / ARTIST</span><span>MODE</span><span>TIME</span></div>{['Ghost in the Jog Dial', 'Halcyon Transit', 'Night Drive Memory', 'Signal Bloom', 'Afterimage'].map((title, index) => <button type="button" className={`studio-track-row ${selectedTrack === index ? 'is-selected' : ''}`} key={title} onClick={(event) => { event.stopPropagation(); setSelectedTrack(index); }}><span>{String(index + 1).padStart(2, '0')}</span><span><b>{title}</b><small>{index % 2 ? 'Halcyon Transit' : 'Neon Arcade'}</small></span><em>SP</em><time>0{index + 2}:2{index}</time></button>)}</div>
                        <div className="studio-transport"><button type="button">|◀</button><button type="button" className="studio-transport-primary">▶</button><button type="button">Ⅱ</button><button type="button">■</button><button type="button">▶|</button><div className="studio-jog">JOG<br /><b>04</b></div></div>
                    </section>
                    <section className={`studio-window studio-window-burner ${activeBay === 'burner' ? 'is-focused' : ''}`} onClick={() => setActiveBay('burner')}>
                        <div className="studio-window-titlebar"><span><i className="studio-window-led studio-window-led-warm" /> BURNER BAY <b>// DISC FIT + LOUDNESS</b></span><span className="studio-window-tools">− □ ×</span></div>
                        <div className="studio-burner-head"><div><small>DISC MAP · SP-EQUIVALENT MINUTES</small><strong>34:12 <em>/ 80:00</em></strong></div><span className="studio-mode-chip">MD-80</span></div>
                        <div className="studio-disc-map"><i style={{ width: '43%' }} /><i style={{ width: '19%' }} /><i style={{ width: '12%' }} /><span>34:12 USED</span></div>
                        <div className="studio-burner-actions"><button type="button" className="studio-action-primary">AUTO-FIT</button><button type="button">ALL SP</button></div>
                        <div className="studio-burner-footer"><span>QUALITY TARGET</span><b>SP · BEST QUALITY</b><span>5 TRACKS READY</span></div>
                    </section>
                    <section className={`studio-window studio-window-eq ${activeBay === 'equalizer' ? 'is-focused' : ''}`} onClick={() => setActiveBay('equalizer')}>
                        <div className="studio-window-titlebar"><span><i className="studio-window-led studio-window-led-purple" /> DSP BAY <b>// EQUALIZER</b></span><span className="studio-window-tools">− □ ×</span></div>
                        <div className="studio-eq-head"><span>RESPONSE CURVE</span><button type="button">EQ ON</button></div>
                        <div className="studio-eq-graph"><svg viewBox="0 0 400 100" preserveAspectRatio="none"><path d="M0 65 C35 62 48 45 80 51 S120 78 155 56 S197 28 226 45 S278 70 308 47 S353 32 400 40" /></svg></div>
                        <div className="studio-eq-sliders">{['60', '250', '1K', '4K', '16K'].map((label, index) => <div key={label}><span>{label}</span><i style={{ height: `${38 + index * 11}%` }} /><b>{index % 2 ? '+2' : '0'} dB</b></div>)}</div>
                    </section>
                    <section className={`studio-window studio-window-label ${activeBay === 'labels' ? 'is-focused' : ''}`} onClick={() => setActiveBay('labels')}>
                        <div className="studio-window-titlebar"><span><i className="studio-window-led studio-window-led-lavender" /> LABEL BAY <b>// DISC FACE + SPINE</b></span><span className="studio-window-tools">− □ ×</span></div>
                        <div className="studio-label-body"><div className="studio-label-controls"><label>ALBUM<input defaultValue="Symphonic Zelda: Disc I" /></label><label>ARTIST<input defaultValue="Koji Kondo · Nintendo" /></label><label>YEAR<input defaultValue="2026" /></label><button type="button">FIND ON MUSICBRAINZ</button><button type="button" className="studio-label-upload">UPLOAD ART</button><small>LAYOUT</small><div className="studio-label-toggle"><button type="button">ART</button><button type="button" className="is-active">ART + TOC</button><button type="button">TYPE ONLY</button></div><small>STICKER STOCK</small><div className="studio-stock-swatches"><i /><i /><i /><i /></div><small>FACE STICKER SIZE (MM)</small><div className="studio-label-dimensions"><label>WIDTH<input defaultValue="38" /></label><label>HEIGHT<input defaultValue="53" /></label></div><p>7 track titles from the disc. Cover art: MusicBrainz / Cover Art Archive, or your own upload.</p></div><div className="studio-print-sheet"><div className="studio-sheet-jcard"><div className="studio-sheet-art"><div className="studio-sheet-rings" /></div><strong>Symphonic Zelda: Disc I</strong><small>2026</small><ol>{['近藤浩治 — ハイラル城', '近藤浩治 — ゼルダ姫のテーマ', '永田権太、若井淑、峰岸透 — 風のタクト'].map((title) => <li key={title}>{title}</li>)}</ol><em>MINIDISC · ATRAC</em></div><div className="studio-sheet-face"><div className="studio-sheet-rings" /><strong>Symphonic Zelda: Disc I</strong><small>2026</small></div><div className="studio-sheet-spine">NETMD<br />2026<span>SYMPHONIC ZELDA // DISC I</span></div><div className="studio-sheet-footer">FACE 38×53 MM · J-CARD 68+5.5+11×73 MM · PRINT AT 100%</div></div></div>
                        <div className="studio-label-actions"><button type="button">CLOSE</button><button type="button">DOWNLOAD PNG (300 DPI)</button><button type="button" className="studio-action-primary">PRINT 1:1</button></div>
                    </section>
                </div>
                <div className="studio-workspace-status"><span><i className="studio-window-led" /> WORKSPACE READY</span><span>USB TRANSFER <b>STANDBY</b></span><span>ATRAC / PCM AUDIO ENGINE</span></div>
            </div>
            <SettingsDialog />
            <AboutDialog />
            <ChangelogDialog />
            <OtherDeviceDialog />
        </React.Fragment>
    );
};

export default Welcome;
