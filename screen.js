// Guitar/Bass Tuner Plugin for Slopsmith
(function() {
    const _TUNER_STORAGE_KEY = 'slopsmith_tuner_settings';

    // ── Player sync state ─────────────────────────────────────────────
    let _onScreenChanged = null;
    let _onSongReady = null;

    // ── Shared mutable state (read/written by screen.js; UI reads via closure) ──
    const _state = {
        uiContainer: null,
        vizContainer: null,
        instrumentSelect: null,
        tuningSelect: null,
        stringNoteContainer: null,
        saveAsCustomContainer: null,
        activeViz: null,
        selectedInstrument: 'guitar-6',
        selectedTuning: null,
        selectedTuningName: 'Standard',
        manualTargetFreq: null,
        tunings: {},
        defaultTunings: {},
        visualizationMode: 'default',
        showFloatingButton: true,
        currentSongOffsets: null,
        currentSongIsBass: false,
        _serverConfig: null,
        enabled: false,
        _instrumentSentinel: null,
        selectedDeviceId: '',
        selectedChannel: 'mono',
    };
    let _tunerUIApi = null;

    // ── Script loader ─────────────────────────────────────────────────
    const _loadedScripts = new Set();
    function _loadScript(url) {
        if (_loadedScripts.has(url)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = () => { _loadedScripts.add(url); resolve(); };
            s.onerror = () => reject(new Error(`Tuner: failed to load "${url}"`));
            document.head.appendChild(s);
        });
    }

    function _loadVizScript(name) {
        return _loadScript(`/api/plugins/tuner/visualization/${name}.js`);
    }

    async function _setVisualization(name) {
        if (_state.activeViz) { _state.activeViz.destroy(); _state.activeViz = null; }
        try {
            await _loadVizScript(name);
            const factory = window[`_tunerViz_${name}`];
            if (typeof factory !== 'function') throw new Error(`Tuner: _tunerViz_${name} not defined`);
            _state.activeViz = factory(_state.vizContainer);
        } catch (e) {
            console.error(e);
            if (name !== 'default') {
                _state.visualizationMode = 'default';
                await _setVisualization('default');
            }
        }
    }

    // ── Tuning helpers ────────────────────────────────────────────────
    function _isTuningEnabled(instrument, name) {
        return !((_state._serverConfig ? _state._serverConfig.disabledTunings : null) || []).includes(instrument + ':' + name);
    }

    function _instrumentForTuning(name) {
        for (var key in _state.defaultTunings) {
            if (_state.defaultTunings[key] && _state.defaultTunings[key][name]) return key;
        }
        return 'guitar-6';
    }

    function _buildTuningsForInstrument(instrument) {
        var result = {};
        if (_state.defaultTunings[instrument]) {
            Object.entries(_state.defaultTunings[instrument]).forEach(([name, val]) => {
                if (_isTuningEnabled(instrument, name)) result[name] = val;
            });
        }
        Object.entries((_state._serverConfig && _state._serverConfig.customTunings) || {}).forEach(function([name, val]) {
            var strings = Array.isArray(val) ? val : (val.strings || []);
            var inst = Array.isArray(val) ? 'guitar-6' : (val.instrument || 'guitar-6');
            if (inst === instrument) result[name] = strings;
        });
        return result;
    }

    // ── Player sync helpers ───────────────────────────────────────────
    function _syncCurrentTuning() {
        const songInfo = window.highway?.getSongInfo();
        if (songInfo && songInfo.tuning && _state.tuningSelect?.querySelector('option[value="_current"]')) {
            const sc = songInfo.stringCount || songInfo.tuning.length;
            const isBass = (songInfo.arrangement || '').toLowerCase().includes('bass');
            _state.currentSongOffsets = songInfo.tuning.slice(0, sc);
            _state.currentSongIsBass = isBass;
            _state.selectedTuning = window._tunerUtils.offsetsToFreqs(_state.currentSongOffsets, isBass);
            const songInstrument = (sc === 4 || sc === 5)
                ? (isBass ? 'bass-' + sc : 'guitar-6')
                : (sc === 7 ? 'guitar-7' : sc === 8 ? 'guitar-8' : 'guitar-6');
            if (songInstrument !== _state.selectedInstrument) {
                _state.selectedInstrument = songInstrument;
                _tunerUIApi?.updateInstrumentDisplay();
            }
        } else {
            const first = Object.keys(_state.tunings)[0];
            if (first) {
                _state.selectedTuningName = first;
                _state.selectedTuning = _state.tunings[first];
                if (_state.tuningSelect) _state.tuningSelect.value = first;
                const derivedInstrument = _instrumentForTuning(first);
                if (derivedInstrument && derivedInstrument !== _state.selectedInstrument) {
                    _state.selectedInstrument = derivedInstrument;
                    if (_state.instrumentSelect) { _state.instrumentSelect.value = derivedInstrument; _tunerUIApi?.updateInstrumentDisplay(); }
                }
            }
        }
        _tunerUIApi?.renderStringNotes();
        _tunerUIApi?.updateSaveAsCustomVisibility();
    }

    // ── Persistence ───────────────────────────────────────────────────
    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(_TUNER_STORAGE_KEY) || '{}');
            if (s.deviceId !== undefined) _state.selectedDeviceId = s.deviceId;
            if (['mono', 'left', 'right'].includes(s.channel)) _state.selectedChannel = s.channel;
        } catch (e) { /* unavailable */ }
    }

    function saveSettings() {
        try {
            localStorage.setItem(_TUNER_STORAGE_KEY, JSON.stringify({
                deviceId: _state.selectedDeviceId,
                channel: _state.selectedChannel,
            }));
        } catch (e) { /* unavailable */ }
    }

    async function loadConfig() {
        try {
            const config = await fetch('/api/plugins/tuner/config').then(r => r.json());
            _state._serverConfig = config;
            _state.defaultTunings = config.defaultTunings || {};
            _state.showFloatingButton = config.showFloatingButton !== false;
            _state.visualizationMode = config.visualizationMode || 'default';

            if (config.lastInstrument && _state.defaultTunings[config.lastInstrument]) {
                _state.selectedInstrument = config.lastInstrument;
            }
            if (_state.instrumentSelect) { _state.instrumentSelect.value = _state.selectedInstrument; _tunerUIApi?.updateInstrumentDisplay(); }

            _state.tunings = _buildTuningsForInstrument(_state.selectedInstrument);

            const lastName = config.lastTuning;
            if (lastName && _state.tunings[lastName]) {
                _state.selectedTuningName = lastName;
                _state.selectedTuning = _state.tunings[lastName];
            } else if (lastName === 'free-tune') {
                _state.selectedTuningName = 'free-tune';
                _state.selectedTuning = [];
            } else {
                const first = Object.keys(_state.tunings)[0];
                if (first) { _state.selectedTuningName = first; _state.selectedTuning = _state.tunings[first]; }
            }

            if (_state.tuningSelect) _tunerUIApi?.renderTuningOptions();
            if (_state.uiContainer && !_state.uiContainer.classList.contains('hidden')) _tunerUIApi?.renderStringNotes();
            _tunerUIApi?.updateSaveAsCustomVisibility();
            _tunerUIApi?.updateFloatingButtonVisibility();
        } catch (e) {
            console.error('Tuner: Failed to load config', e);
        }
    }

    window._tunerReloadConfig = loadConfig;

    async function saveConfig() {
        const tuningToSave = (_state.selectedTuningName === '_current' || _state.selectedTuningName === 'free-tune')
            ? null : _state.selectedTuningName;
        try {
            await fetch('/api/plugins/tuner/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lastTuning: tuningToSave,
                    lastInstrument: _state.selectedInstrument,
                    visualizationMode: _state.visualizationMode,
                }),
            });
        } catch (e) {
            console.error('Tuner: Failed to save config', e);
        }
    }

    // ── Audio lifecycle ───────────────────────────────────────────────
    async function restartAudio() {
        _state.uiContainer?.querySelector('.tuner-mic-error')?.remove();
        try {
            await window._tunerAudio.restart({ deviceId: _state.selectedDeviceId, channel: _state.selectedChannel });
        } catch (e) {
            console.error('Tuner: Failed to restart audio', e);
            disable();
            _tunerUIApi?.showMicError(e);
        }
    }

    async function enable() {
        if (_state.enabled) return;
        await _loadScript('/api/plugins/tuner/utils/tuning-utils.js');
        await _loadScript('/api/plugins/tuner/utils/audio.js');
        await _loadScript('/api/plugins/tuner/utils/ui.js');
        loadSettings();
        await loadConfig();

        if (document.querySelector('.screen.active')?.id === 'player') _state.selectedTuningName = '_current';

        if (!_tunerUIApi) {
            _tunerUIApi = window._tunerUI(_state, {
                saveConfig, loadConfig, saveSettings, disable, restartAudio,
                setVisualization: _setVisualization,
                buildTuningsForInstrument: _buildTuningsForInstrument,
            });
        }
        _tunerUIApi.initUI();
        _tunerUIApi.renderInstrumentOptions();
        _tunerUIApi.renderTuningOptions();
        if (_state.selectedTuningName === '_current') _syncCurrentTuning();
        else if (_state.selectedTuning) _tunerUIApi.renderStringNotes();
        _tunerUIApi.updateSaveAsCustomVisibility();

        await _setVisualization(_state.visualizationMode);

        _state.uiContainer.classList.remove('hidden');
        _state.uiContainer.classList.add('flex');

        if (window.slopsmith && !_onScreenChanged) {
            _onScreenChanged = () => { disable(); };
            _onSongReady = () => {
                _tunerUIApi.renderTuningOptions();
                if (_state.selectedTuningName === '_current') _syncCurrentTuning();
            };
            window.slopsmith.on('screen:changed', _onScreenChanged);
            window.slopsmith.on('song:ready', _onSongReady);
        }

        _state.uiContainer?.querySelector('.tuner-mic-error')?.remove();
        try {
            await window._tunerAudio.start(
                { deviceId: _state.selectedDeviceId, channel: _state.selectedChannel },
                _tunerUIApi.updateUI
            );
            _state.enabled = true;
            if (window.tuner?.updateButtons) window.tuner.updateButtons();
        } catch (e) {
            console.error('Tuner: Failed to start audio', e);
            disable();
            _tunerUIApi?.showMicError(e);
        }
    }

    function disable() {
        _state.enabled = false;
        _state.manualTargetFreq = null;
        if (_state.activeViz) { _state.activeViz.destroy(); _state.activeViz = null; }
        if (_state.uiContainer) { _state.uiContainer.classList.add('hidden'); _state.uiContainer.classList.remove('flex'); }
        if (_onScreenChanged) { window.slopsmith?.off('screen:changed', _onScreenChanged); _onScreenChanged = null; }
        if (_onSongReady) { window.slopsmith?.off('song:ready', _onSongReady); _onSongReady = null; }
        if (window._tunerAudio) window._tunerAudio.stop();
        if (_state.vizContainer) _state.vizContainer.innerHTML = '';
        if (window.tuner?.updateButtons) window.tuner.updateButtons();
    }

    window.tuner = {
        enable,
        disable,
        toggle: () => _state.enabled ? disable() : enable(),
        updateButtons: () => {
            _tunerUIApi?.updateFloatingButton();
            _tunerUIApi?.updatePlayerButton();
            _tunerUIApi?.updateFloatingButtonVisibility();
        },
    };

    // Boot: preload scripts and create UI handle for the toggle button
    _loadScript('/api/plugins/tuner/utils/tuning-utils.js').catch(e => console.error(e));
    _loadScript('/api/plugins/tuner/utils/ui.js').then(() => {
        _tunerUIApi = window._tunerUI(_state, {
            saveConfig, loadConfig, saveSettings, disable, restartAudio,
            setVisualization: _setVisualization,
            buildTuningsForInstrument: _buildTuningsForInstrument,
        });
        _tunerUIApi.addButton();
    }).catch(e => console.error(e));
    console.log('Tuner plugin loaded. Use window.tuner.toggle() to open.');
})();
