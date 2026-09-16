// MiniDisc Studio fork branding changes: 2026-09-16.
import React, { useCallback, useState } from 'react';
import { useDispatch, batchActions } from '../frontend-utils';
import { deleteService, pair } from '../redux/actions';

import { useShallowEqualSelector } from '../frontend-utils';

import { makeStyles } from 'tss-react/mui';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';

import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { TopMenu } from './topmenu';
import ChromeIconPath from '../images/chrome-icon.svg';
import { W95Welcome } from './win95/welcome';

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
    notice: {
        marginTop: theme.spacing(2),
        backgroundColor: 'unset',
    },
    chromeLogo: {
        marginTop: theme.spacing(1),
        width: 96,
        height: 96,
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
        vintageMode,
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

    const [showWhyUnsupported, setWhyUnsupported] = useState(false);
    const handleLearnWhy = (event: React.SyntheticEvent) => {
        event.preventDefault();
        setWhyUnsupported(true);
    };

    const forceContinue = (event: React.SyntheticEvent) => {
        event.preventDefault();
        dispatch(appActions.setBrowserSupported(true));
    };

    if (vintageMode) {
        const p = {
            dispatch,
            pairingFailed,
            pairingMessage,
            createService: () => createService(availableServices[lastSelectedService]) ?? null,
            spec: getServiceSpec(availableServices[lastSelectedService])!,
            connectName: getConnectButtonName(availableServices[lastSelectedService]),
        };
        return <W95Welcome {...p}></W95Welcome>;
    }

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
            <div className="studio-welcome">
                <div className="studio-welcome-toolbar">
                    <div>
                        <div className="studio-eyebrow">MINIDISC / DIGITAL AUDIO SYSTEM</div>
                        <div className="studio-welcome-title">Make a little noise.</div>
                    </div>
                    <TopMenu />
                </div>

                <div className="studio-dashboard-grid">
                    <section className="studio-hero-panel">
                        <div className="studio-hero-copy">
                            <div className="studio-live-label"><span className="studio-status-dot" /> DEVICE BAY / STANDBY</div>
                            <div className="studio-display-title">Your next mix,<br /><em>etched in light.</em></div>
                            <p>Connect a NetMD deck to move music between your collection and the disc.</p>
                        </div>
                        <div className="studio-disc-stage" aria-hidden="true">
                            <div className="studio-disc-orbit studio-disc-orbit-one" />
                            <div className="studio-disc-orbit studio-disc-orbit-two" />
                            <div className="studio-disc-art"><div className="studio-disc-center"><span>MD</span><small>STUDIO EDITION</small></div></div>
                            <div className="studio-disc-tag studio-disc-tag-left">ATRAC / PCM<br /><b>AUDIO ENGINE</b></div>
                            <div className="studio-disc-tag studio-disc-tag-right">NETMD<br /><b>TRANSFER LINK</b></div>
                        </div>
                        <div className="studio-hero-bottom">
                            <span>01 <b>TRANSFER</b></span><span>02 <b>RECORD</b></span><span>03 <b>ARCHIVE</b></span>
                            <svg className="studio-wave-line" viewBox="0 0 250 34" preserveAspectRatio="none"><path d="M0 18h28l7-2 5 4 9-1 7-8 6 17 9-25 7 22 7-13 6 6 8-2h18l8-5 7 12 7-21 8 22 6-11 8 6 7-4h22l9-3 8 6 10-2h25" /></svg>
                        </div>
                    </section>

                    <aside className="studio-side-stack">
                        <section className="studio-connect-panel">
                            <div className="studio-panel-topline"><span>01 / HARDWARE</span><span className="studio-disconnected">NO DECK LINKED</span></div>
                            {browserSupported ? (
                                <>
                                    <h2>Bring your deck online</h2>
                                    <p>Choose a connection to open your disc workspace.</p>
                                    <SplitButton
                                        options={options}
                                        color="primary"
                                        boxClassName={`${classes.buttonBox} studio-connect-button`}
                                        width={200}
                                        disabled={Services[lastSelectedService].requiresChrome && !runningChrome}
                                        selectedIndex={lastSelectedService}
                                        dropdownMapping={mapToEntry}
                                        loading={connectingInProgress}
                                    />
                                    <FormControl error={true} className={classes.spacing} style={{ visibility: pairingFailed ? 'visible' : 'hidden' }}>
                                        <FormHelperText>{pairingMessage}</FormHelperText>
                                    </FormControl>
                                    {!window.native?.interface && (
                                        <Tooltip title={<span>Vivaldi's WebUSB implementation is unreliable. Please use another Chromium based browser.</span>}>
                                            <Alert severity="info" className={classes.notice}><b>Vivaldi browser notice</b></Alert>
                                        </Tooltip>
                                    )}
                                </>
                            ) : (
                                <div className="studio-browser-warning">
                                    <h2>Browser link unavailable</h2>
                                    <p>This browser needs WebUSB and WebAssembly to control a local deck.</p>
                                    <Link rel="noopener noreferrer" href="#" onClick={handleLearnWhy}>Learn why</Link>
                                    <div className="studio-browser-actions">
                                        <Link rel="noopener noreferrer" target="_blank" href="https://www.google.com/chrome/"><img alt="Chrome Logo" src={ChromeIconPath} className={classes.chromeLogo} /></Link>
                                        <button className="studio-text-button" onClick={forceContinue}>Continue for remote devices</button>
                                    </div>
                                    {showWhyUnsupported && <p className="studio-browser-detail">WebUSB provides deck control; WebAssembly converts audio for MiniDisc.</p>}
                                </div>
                            )}
                            <Link className="studio-guide-link" rel="noopener noreferrer" target="_blank" href="https://www.minidisc.wiki/guides/webminidisc">
                                SETUP GUIDE <OpenInNewIcon fontSize="inherit" />
                            </Link>
                        </section>

                        <section className="studio-spectrum-panel" aria-label="Audio spectrum display">
                            <div className="studio-panel-topline"><span>02 / SIGNAL MONITOR</span><span>AWAITING INPUT</span></div>
                            <div className="studio-spectrum-display" aria-hidden="true">
                                <div className="studio-spectrum-grid" />
                                <div className="studio-spectrum-bars">{Array.from({ length: 38 }, (_, index) => <i key={index} style={{ height: `${14 + ((index * 19 + (index % 6) * 13) % 82)}%`, animationDelay: `${index * -53}ms` }} />)}</div>
                            </div>
                            <div className="studio-spectrum-footer"><span>LEFT <i /></span><span>RIGHT <i /></span></div>
                        </section>
                    </aside>
                </div>

                <div className="studio-mode-strip">
                    <div><span className="studio-mode-number">A</span><span><b>TRANSFER TO MD</b><small>Drop in a playlist and shape your track order.</small></span></div>
                    <div><span className="studio-mode-number">B</span><span><b>RECORD IN REAL TIME</b><small>Capture line-in audio straight to disc.</small></span></div>
                    <div><span className="studio-mode-number">C</span><span><b>RIP & ARCHIVE</b><small>Bring tracks back from supported decks.</small></span></div>
                </div>
            </div>
            <SettingsDialog />
            <AboutDialog />
            <ChangelogDialog />
            <OtherDeviceDialog />
        </React.Fragment>
    );
};

export default Welcome;
