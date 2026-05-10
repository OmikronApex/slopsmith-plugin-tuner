# Slopsmith Tuner Plugin

A real-time guitar and bass tuner plugin for [Slopsmith](https://github.com/byrongamatos/slopsmith).

<img width="315" height="444" alt="grafik" src="https://github.com/user-attachments/assets/1cde859e-d978-416a-b68b-5f4fda218309" />


This plugin adds a floating "Tuner" button to the Slopsmith interface, providing a high-accuracy chromatic tuner with support for multiple presets and custom tunings.

## Features

- **Real-time Pitch Detection**: Uses the YIN algorithm for robust and accurate frequency tracking.
- **Multiple Presets**: Includes common guitar and bass tunings (Standard, Drop D, DADGAD, Open G, etc.).
- **Manual & Auto Tracking**: Automatically estimates the closest string or allows manual selection for focused tuning.
- **Visual Feedback**: Large cents-deviation gauge and frequency display.
- **Custom Tunings**: Add your own tunings via note names (e.g., E2, A2) or Hz frequencies in the settings.
- **Themable UI**: Styled with Tailwind CSS to match your Slopsmith theme.

## Installation

```bash
cd /path/to/slopsmith/plugins
git clone https://github.com/OmikronApex/slopsmith-plugin-tuner.git tuner
# Restart Slopsmith (or restart your docker container)
docker compose restart
```

## How to Use

1. Click the **Tuner** button at the bottom-right of the screen.
2. Select your instrument's tuning from the dropdown menu.
3. Pluck a string. The tuner will automatically detect the closest string in the selected tuning.
4. (Optional) Click a specific note button in the tuner window to lock onto that string (useful for very out-of-tune strings).
5. Adjust your tuning until the needle is centered and the indicator turns green.

## Configuration

Access the tuner settings via the Slopsmith Plugin Manager (Settings -> Plugins -> Tuner):
- **Tuning Visibility**: Toggle which built-in tunings appear in your menu.
- **Custom Tunings**: Define your own tuning presets by entering a name and a list of notes/frequencies.

## License

MIT
