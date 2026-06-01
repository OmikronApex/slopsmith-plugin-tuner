/**
 * Tailwind build config for the Tuner plugin's OWN stylesheet.
 *
 * Slopsmith serves Tailwind as a prebuilt stylesheet and core only scans core
 * source at build time (constitution Principle II — no Play CDN / runtime JIT).
 * This plugin owns its utilities so it styles correctly even when core's build
 * didn't scan it. Arbitrary values (`text-[11px]`, `z-[1000]`, opacity modifiers
 * on custom colours) are not present in any "complete" Tailwind set, so a
 * self-built, content-scanned sheet is mandatory.
 *
 * Regenerate assets/plugin.css with:  bash build-tailwind.sh
 */
module.exports = {
    // Core ships the single base reset; this plugin emits utilities only so it
    // doesn't double the preflight and fight core's styles.
    corePlugins: { preflight: false },
    content: [
        './screen.js',
        './settings.html',
        './utils/ui.js',
        './utils/audio.js',
        './visualization/default.js',
        './visualization/strobe.js',
        './visualization/analogue-gauge.js',
        './visualization/mace-fx-iii.js',
        './visualization/toilet-tuner.js',
        './visualization/pp-tiny.js',
        './visualization/chef-mt3.js',
    ],
    theme: {
        extend: {
            // Mirror core's theme tokens so classes like `bg-dark-700` compile
            // inside this standalone build.
            colors: {
                dark: { 900: '#050508', 800: '#0a0a12', 700: '#10101e', 600: '#181830', 500: '#1e1e3a' },
                accent: { DEFAULT: '#4080e0', light: '#60a0ff', dark: '#2060b0' },
                gold: '#e8c040',
            },
            fontFamily: {
                display: ['"Inter"', 'system-ui', 'sans-serif'],
            },
        },
    },
    // Belt-and-suspenders for any dark/accent class built indirectly.
    safelist: [
        { pattern: /^(bg|text|border)-(dark|accent)(-.+)?$/ },
    ],
    plugins: [],
};
