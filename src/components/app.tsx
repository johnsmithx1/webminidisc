import React, { useMemo, lazy, Suspense } from 'react';
import { belowDesktop, forAnyDesktop, forWideDesktop, useShallowEqualSelector, useThemeDetector } from '../frontend-utils';

import CssBaseline from '@mui/material/CssBaseline';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import { W95App } from './win95/app';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import { LabelBayDialog } from './label-bay-dialog';

const Toc = lazy(() => import('./factory/factory'));
const Controls = lazy(() => import('./controls'));
const Welcome = lazy(() => import('./welcome'));
const Main = lazy(() => import('./main'));
const useStyles = makeStyles()((theme) => ({
    layout: {
        width: 'auto',
        height: '100%',
        [forAnyDesktop(theme)]: {
            width: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
        },
        [forWideDesktop(theme)]: {
            width: 700,
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
            height: 200,
        },
        [forWideDesktop(theme)]: {
            height: 250,
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
    copyrightTypography: {
        textAlign: 'center',
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
            light: '#6ec6ff',
            main: '#2196f3',
            dark: '#0069c0',
            contrastText: '#fff',
        },
        secondary: {
            light: '#ff4081',
            main: '#f50057',
            dark: '#c51162',
        },
        background: {
            default: '#303030',
            paper: '#424242',
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

// ---- MD Studio Industrial: magnesium chassis + EL backlit LCD -------------------------------
const STUDIO = {
    chassis: '#111316',
    panel: '#1B1C1F',
    raised: '#232428',
    hairline: '#2E3035',
    lime: '#87EF7E',
    limeHi: '#D8FFCD',
    peak: '#F6FFBF',
    lavender: '#AD89F0',
    text: '#E3E2E6',
    muted: '#9A9CA3',
};
const STUDIO_MONO = "'Geist Mono', ui-monospace, Menlo, monospace";
const STUDIO_GLOW = '0 0 1px #D8FFCD, 0 0 4px rgba(135,239,126,.85), 0 0 12px rgba(135,239,126,.45)';

const studioTheme = createTheme({
    studio: true,
    palette: {
        mode: 'dark',
        primary: { light: STUDIO.limeHi, main: STUDIO.lime, dark: '#5DBF55', contrastText: '#0E1A0E' },
        secondary: { light: '#C9B0F7', main: STUDIO.lavender, dark: '#7E5CC2', contrastText: '#16121F' },
        warning: { light: '#FBFFE0', main: STUDIO.peak, dark: '#C9CF8F', contrastText: '#1A1C10' },
        error: { light: '#FFC2AD', main: '#FF9E7A', dark: '#D9714C', contrastText: '#1A0E0A' },
        info: { light: STUDIO.limeHi, main: STUDIO.lime, dark: '#5DBF55', contrastText: '#0E1A0E' },
        success: { light: STUDIO.limeHi, main: STUDIO.lime, dark: '#5DBF55', contrastText: '#0E1A0E' },
        background: { default: STUDIO.chassis, paper: STUDIO.panel },
        text: { primary: STUDIO.text, secondary: STUDIO.muted, disabled: '#5C5F66' },
        divider: STUDIO.hairline,
        action: {
            active: STUDIO.text,
            hover: 'rgba(135,239,126,0.06)',
            hoverOpacity: 0.06,
            selected: 'rgba(135,239,126,0.12)',
            selectedOpacity: 0.12,
            disabled: 'rgba(227,226,230,0.3)',
            disabledBackground: 'rgba(227,226,230,0.08)',
            disabledOpacity: 0.38,
            focus: 'rgba(135,239,126,0.14)',
            focusOpacity: 0.14,
            activatedOpacity: 0.2,
        },
    },
    shape: { borderRadius: 4 },
    typography: {
        fontFamily: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
        button: { fontFamily: STUDIO_MONO, fontWeight: 500, letterSpacing: '0.12em' },
        caption: { fontFamily: STUDIO_MONO, letterSpacing: '0.06em' },
        overline: { fontFamily: STUDIO_MONO, letterSpacing: '0.2em' },
    },
    components: {
        ...themeCommons.components,
        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: '#0A0B0D' },
                '@media (prefers-reduced-motion: reduce)': { '*': { animationDuration: '0s !important' } },
            },
        },
        MuiPaper: {
            defaultProps: { elevation: 1 },
            styleOverrides: {
                root: { backgroundImage: 'none', border: `1px solid ${STUDIO.hairline}` },
                elevation24: { backgroundImage: 'none !important' },
            },
        },
        MuiButton: {
            styleOverrides: {
                containedPrimary: {
                    boxShadow: '0 0 14px rgba(135,239,126,0.45), inset 0 -3px 0 #5DBF55',
                    '&:hover': { boxShadow: '0 0 22px rgba(135,239,126,0.6), inset 0 -3px 0 #5DBF55' },
                },
                outlined: { borderColor: '#3A3D44' },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    fontFamily: STUDIO_MONO,
                    letterSpacing: '0.1em',
                    borderColor: '#3A3D44',
                    '&.Mui-selected': {
                        color: STUDIO.lime,
                        textShadow: STUDIO_GLOW,
                        backgroundColor: 'rgba(135,239,126,0.10)',
                        boxShadow: 'inset 0 -2px 0 #87EF7E',
                    },
                },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                bar: { boxShadow: '0 0 8px rgba(135,239,126,0.8)' },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: { borderBottomColor: '#25272B' },
                head: { fontFamily: STUDIO_MONO, fontSize: '0.7rem', letterSpacing: '0.18em', color: STUDIO.muted },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&.Mui-selected, &.Mui-selected:hover': {
                        backgroundColor: 'rgba(135,239,126,0.10)',
                        boxShadow: `inset 2px 0 0 ${STUDIO.lime}`,
                    },
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: { fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: '1rem' },
            },
        },
        MuiSlider: {
            styleOverrides: {
                track: { boxShadow: '0 0 6px rgba(135,239,126,0.7)' },
                thumb: { borderRadius: 2, width: 18, height: 10 },
            },
        },
        MuiSwitch: {
            styleOverrides: {
                switchBase: { '&.Mui-checked + .MuiSwitch-track': { boxShadow: '0 0 8px rgba(135,239,126,0.6)' } },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    fontFamily: STUDIO_MONO,
                    backgroundColor: '#0B120C',
                    border: `1px solid ${STUDIO.hairline}`,
                    color: STUDIO.limeHi,
                },
            },
        },
    },
} as any);

const InternalApp = () => {
    const { mainView, loading, pageFullHeight, pageFullWidth } = useShallowEqualSelector((state) => state.appState);
    const { deviceCapabilities } = useShallowEqualSelector((state) => state.main);
    const { classes, cx } = useStyles();

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
                <main className={cx(classes.layout, { [classes.layoutFullWidth]: pageFullWidth })}>
                    <Paper
                        className={cx(classes.paper, {
                            [classes.paperShowsList]: deviceCapabilities.includes(0 /*Capability.listContent*/),
                            [classes.paperFullHeight]: pageFullHeight,
                        })}
                    >
                        {mainView === 'WELCOME' ? <Welcome /> : null}
                        {mainView === 'MAIN' ? <Main /> : null}
                        {mainView === 'FACTORY' ? <Toc /> : null}

                        <Box className={classes.controlsContainer}>{mainView === 'MAIN' ? <Controls /> : null}</Box>
                    </Paper>
                    <Typography variant="body2" color="textSecondary" className={classes.copyrightTypography}>
                        {'© '}
                        <Link rel="noopener noreferrer" color="inherit" target="_blank" href="https://stefano.brilli.me/">
                            Stefano Brilli
                        </Link>
                        {', '}
                        <Link rel="noopener noreferrer" color="inherit" target="_blank" href="https://github.com/asivery/">
                            Asivery
                        </Link>{' '}
                        {new Date().getFullYear()}
                        {'.'}
                    </Typography>
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
    const { colorTheme, vintageMode } = useShallowEqualSelector((state) => state.appState);
    const systemIsDarkTheme = useThemeDetector();

    const theme = useMemo(() => {
        switch (colorTheme) {
            case 'light':
                return lightTheme;
            case 'dark':
                return darkTheme;
            case 'system':
                return systemIsDarkTheme ? darkTheme : lightTheme;
            case 'studio':
                return studioTheme;
            default:
                return darkTheme;
        }
    }, [systemIsDarkTheme, colorTheme]);

    if (vintageMode) {
        return <W95App />;
    }

    return (
        <ThemeProvider theme={theme}>
            <InternalApp />
            <LabelBayDialog />
        </ThemeProvider>
    );
};

export default App;
