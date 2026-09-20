// Studio MD fork UI shell changes: 2026-09-19. Upstream device behavior remains unchanged.
import React, { useMemo, lazy, Suspense } from 'react';
import { belowDesktop, forAnyDesktop, forWideDesktop, useDispatch, useShallowEqualSelector, useThemeDetector } from '../frontend-utils';

import CssBaseline from '@mui/material/CssBaseline';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import './studio-theme.css';
import { LabelBayDialog } from './label-bay-dialog';
import { actions as labelBayActions } from '../redux/label-bay-feature';

const Toc = lazy(() => import('./factory/factory'));
const Controls = lazy(() => import('./controls'));
const Welcome = lazy(() => import('./welcome'));
const StudioDemo = lazy(() => import('./studio-demo'));
const Main = lazy(() => import('./main'));
const useStyles = makeStyles()((theme) => ({
    layout: {
        width: 'auto',
        height: 'auto',
        minHeight: '100vh',
        maxWidth: 1480,
        margin: '0 auto',
        padding: '0 24px 18px',
        [forAnyDesktop(theme)]: {
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
        },
        [forWideDesktop(theme)]: {
            width: '100%',
        },
    },

    paper: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: theme.spacing(2),
        height: 'calc(100% - 20px)',
        [forAnyDesktop(theme)]: {
            marginTop: theme.spacing(2),
            marginBottom: theme.spacing(1),
            padding: theme.spacing(3),
            height: 'auto',
            minHeight: 600,
        },
        [forWideDesktop(theme)]: {
            height: 'auto',
            minHeight: 680,
        },
    },
    paperShowsList: {
        [forAnyDesktop(theme)]: {
            height: 600,
        },
        [forWideDesktop(theme)]: {
            height: 700,
        },
    },
    paperFullHeight: {
        height: 'calc(100% - 50px)',
    },
    layoutFullWidth: {
        [forAnyDesktop(theme)]: {
            width: '90%',
        },
    },
    bottomBar: {
        display: 'flex',
        alignItems: 'center',
        [belowDesktop(theme)]: {
            flexWrap: 'wrap',
        },
        marginLeft: -theme.spacing(2),
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1000,
        color: '#fff',
    },
    minidiscLogo: {
        width: 48,
    },
    controlsContainer: {
        flex: '0 0 auto',
        width: '100%',
        paddingRight: theme.spacing(8),
        [belowDesktop(theme)]: {
            paddingLeft: 0,
        },
    },
}));

const themeCommons = {
    components: {
        MuiSelect: {
            defaultProps: { variant: 'standard' },
        },
        MuiPaper: {
            defaultProps: { elevation: 1 },
            styleOverrides: {
                elevation24: {
                    backgroundImage: 'none !important',
                },
            },
        },
        MuiDialog: {
            defaultProps: {
                PaperProps: {
                    elevation: 0,
                },
            },
        },
        MuiMenu: {
            defaultProps: {
                PaperProps: {
                    elevation: 24,
                },
            },
        },
        MuiTextField: {
            defaultProps: { variant: 'standard' },
        },
    },
} as const;

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            light: '#d8ffcd',
            main: '#87ef7e',
            dark: '#5dbf55',
            contrastText: '#0e1a0e',
        },
        secondary: {
            light: '#dcd0f2',
            main: '#ad89f0',
            dark: '#8065b3',
        },
        background: {
            default: '#131314',
            paper: '#1b1c1f',
        },
        action: {
            active: '#fff',
            hover: 'rgba(255, 255, 255, 0.08)',
            hoverOpacity: 0.08,
            selected: 'rgba(255, 255, 255, 0.16)',
            selectedOpacity: 0.16,
            disabled: 'rgba(255, 255, 255, 0.3)',
            disabledBackground: 'rgba(255, 255, 255, 0.12)',
            disabledOpacity: 0.38,
            focus: 'rgba(255, 255, 255, 0.12)',
            focusOpacity: 0.12,
            activatedOpacity: 0.24,
        },
    },
    ...themeCommons,
});

const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            light: '#7986cb',
            main: '#3f51b5',
            dark: '#303f9f',
            contrastText: '#fff',
        },
        secondary: {
            light: '#ff4081',
            main: '#f50057',
            dark: '#c51162',
            contrastText: '#fff',
        },
        error: {
            light: '#e57373',
            main: '#f44336',
            dark: '#d32f2f',
            contrastText: '#fff',
        },
        warning: {
            light: '#ffb74d',
            main: '#ff9800',
            dark: '#f57c00',
            contrastText: 'rgba(0, 0, 0, 0.87)',
        },
        info: {
            light: '#64b5f6',
            main: '#2196f3',
            dark: '#1976d2',
            contrastText: '#fff',
        },
        success: {
            light: '#81c784',
            main: '#4caf50',
            dark: '#388e3c',
            contrastText: 'rgba(0, 0, 0, 0.87)',
        },
        text: {
            primary: 'rgba(0, 0, 0, 0.87)',
            secondary: 'rgba(0, 0, 0, 0.54)',
            disabled: 'rgba(0, 0, 0, 0.38)',
        },
        background: {
            paper: '#fff',
            default: '#fafafa',
        },
        action: {
            active: 'rgba(0, 0, 0, 0.54)',
            hover: 'rgba(0, 0, 0, 0.04)',
            hoverOpacity: 0.04,
            selected: 'rgba(0, 0, 0, 0.08)',
            selectedOpacity: 0.08,
            disabled: 'rgba(0, 0, 0, 0.26)',
            disabledBackground: 'rgba(0, 0, 0, 0.12)',
            disabledOpacity: 0.38,
            focus: 'rgba(0, 0, 0, 0.12)',
            focusOpacity: 0.12,
            activatedOpacity: 0.12,
        },
    },
    ...themeCommons,
});

const InternalApp = () => {
    const dispatch = useDispatch();
    const { mainView, loading, pageFullHeight, pageFullWidth } = useShallowEqualSelector((state) => state.appState);
    const { deviceCapabilities, deviceName, disc } = useShallowEqualSelector((state) => state.main);
    const { classes, cx } = useStyles();
    const showStudioDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1';

    return (
        <React.Fragment>
            <CssBaseline />

            <Suspense
                fallback={
                    <Backdrop open={true}>
                        <CircularProgress color="info" />
                    </Backdrop>
                }
            >
                <main className={cx('studio-layout', classes.layout, { [classes.layoutFullWidth]: pageFullWidth })}>
                    <header className="studio-header">
                        <div className="studio-brand">
                            <div className="studio-brand-mark" aria-hidden="true">MD</div>
                            <div>
                            <div className="studio-brand-name">STUDIO MD</div>
                                <div className="studio-brand-caption">DISC CONTROL SYSTEM</div>
                            </div>
                        </div>
                        {mainView === 'MAIN' ? (
                            <div className="studio-header-device"><b>{deviceName || 'NETMD DECK'}</b><span>NETMD USB · TYPE-R</span></div>
                        ) : null}
                        <div className="studio-header-status"><span className="studio-status-dot" /> {mainView === 'MAIN' ? 'DECK ONLINE' : 'READY FOR DEVICE'}</div>
                    </header>
                    {mainView === 'MAIN' ? (
                        <nav className="studio-connected-nav" aria-label="Studio bays">
                            <span className="is-active">DISC TOC &amp; BURNER</span><span>TITLING &amp; EDIT</span><span>HARDWARE EXPLORER</span><span>DSP BAY <b>NEW</b></span><button type="button" onClick={() => dispatch(labelBayActions.setVisible(true))}>LABEL BAY</button><span>EXPLOIT / HOMEBREW</span><span>AUDIO CONVERTER</span><span>DEVICE HANDSHAKE</span>
                        </nav>
                    ) : null}
                    <Paper
                        data-studio-surface="true"
                        className={cx(classes.paper, {
                            [classes.paperShowsList]: deviceCapabilities.includes(0 /*Capability.listContent*/),
                            [classes.paperFullHeight]: pageFullHeight,
                        })}
                    >
                        {mainView === 'WELCOME' ? (showStudioDemo ? <StudioDemo /> : <Welcome />) : null}
                        {mainView === 'MAIN' ? <Main /> : null}
                        {mainView === 'FACTORY' ? <Toc /> : null}

                        <Box className={classes.controlsContainer}>{mainView === 'MAIN' ? <Controls /> : null}</Box>
                    </Paper>
                </main>
            </Suspense>

            {loading ? (
                <Backdrop className={classes.backdrop} open={loading}>
                    <CircularProgress color="info" />
                </Backdrop>
            ) : null}
        </React.Fragment>
    );
};

const App = () => {
    const { colorTheme } = useShallowEqualSelector((state) => state.appState);
    const systemIsDarkTheme = useThemeDetector();

    const theme = useMemo(() => {
        switch (colorTheme) {
            case 'light':
                return lightTheme;
            case 'dark':
                return darkTheme;
            case 'system':
                return systemIsDarkTheme ? darkTheme : lightTheme;
        }
    }, [systemIsDarkTheme, colorTheme]);

    return (
        <ThemeProvider theme={theme}>
            <InternalApp />
            <LabelBayDialog />
        </ThemeProvider>
    );
};

export default App;
