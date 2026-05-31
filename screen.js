// Guitar/Bass Tuner Plugin for Slopsmith
(function() {
    const _TUNER_MIN_YIN_SAMPLES = 4096;
    const _TUNER_FRAME_SIZE = 2048;
    const _TUNER_MIN_DETECTABLE_HZ = 20;

    // ── Audio pipeline state ──────────────────────────────────────────
    let enabled = false;
    let audioCtx = null;
    let sourceNode = null;
    let stream = null;
    let processor = null;
    let gainNode = null;
    let accumBuffer = new Float32Array(0);
    let pendingBuffer = null;
    let detectInterval = null;
    let processingFrame = false;
    let yinWorker = null;

    // ── Pitch stability state ─────────────────────────────────────────
    let _freqHistory = [];
    let _validFrameCount = 0;
    const _FREQ_HISTORY_LEN = 3;
    const _WARMUP_FRAMES = 2;   // skip pluck-attack transient before showing pitch

    function _median(arr) {
        if (!arr.length) return 0;
        var s = arr.slice().sort(function(a, b) { return a - b; });
        var mid = Math.floor(s.length / 2);
        return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }

    // ── Player sync state ─────────────────────────────────────────────
    let _onScreenChanged = null;
    let _onSongReady = null;

    // ── UI handles ────────────────────────────────────────────────────
    let uiContainer = null;
    let vizContainer = null;
    let tuningSelect = null;
    let stringNoteContainer = null;

    // ── Viz state ─────────────────────────────────────────────────────
    let activeViz = null;

    // ── Tuning state ──────────────────────────────────────────────────
    let defaultTunings = {};
    let tunings = {};
    let selectedTuning = null;
    let selectedTuningName = 'Guitar Standard';
    let manualTargetFreq = null;

    // ── Settings ──────────────────────────────────────────────────────
    let showFloatingButton = true;
    let visualizationMode = 'default';
    let selectedDeviceId = '';
    let selectedChannel = 'mono';
    const _TUNER_STORAGE_KEY = 'slopsmith_tuner_settings';

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

    // ── Viz loader ────────────────────────────────────────────────────
    // Dynamically loads visualization/<name>.js on first use, then
    // instantiates it. New viz = drop a file in visualization/ and add
    // an option to the settings select. No other changes needed.
    function _loadVizScript(name) {
        return _loadScript(`/api/plugins/tuner/visualization/${name}.js`);
    }

    async function _setVisualization(name) {
        if (activeViz) { activeViz.destroy(); activeViz = null; }
        try {
            await _loadVizScript(name);
            const factory = window[`_tunerViz_${name}`];
            if (typeof factory !== 'function') throw new Error(`Tuner: _tunerViz_${name} not defined`);
            activeViz = factory(vizContainer);
        } catch (e) {
            console.error(e);
        }
    }

    // ── Player sync helpers ───────────────────────────────────────────
    function _syncCurrentTuning() {
        const songInfo = window.highway?.getSongInfo();
        if (songInfo && songInfo.tuning && tuningSelect?.querySelector('option[value="_current"]')) {
            const sc = songInfo.stringCount || songInfo.tuning.length;
            selectedTuning = window._tunerUtils.offsetsToFreqs(
                songInfo.tuning.slice(0, sc),
                (songInfo.arrangement || '').toLowerCase().includes('bass'),
            );
        } else {
            const first = Object.keys(tunings)[0];
            if (first) {
                selectedTuningName = first;
                selectedTuning = tunings[first];
                if (tuningSelect) tuningSelect.value = first;
            }
        }
        renderStringNotes();
    }

    // ── Persistence ───────────────────────────────────────────────────
    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(_TUNER_STORAGE_KEY) || '{}');
            if (s.deviceId !== undefined) selectedDeviceId = s.deviceId;
            if (['mono', 'left', 'right'].includes(s.channel)) selectedChannel = s.channel;
        } catch (e) { /* unavailable */ }
    }

    function saveSettings() {
        try {
            localStorage.setItem(_TUNER_STORAGE_KEY, JSON.stringify({
                deviceId: selectedDeviceId,
                channel: selectedChannel,
            }));
        } catch (e) { /* unavailable */ }
    }

    async function loadConfig() {
        try {
            const config = await fetch('/api/plugins/tuner/config').then(r => r.json());

            defaultTunings = config.defaultTunings || {};
            showFloatingButton = config.showFloatingButton !== false;
            visualizationMode = config.visualizationMode || 'default';

            tunings = {};
            Object.values(defaultTunings).forEach(group => {
                Object.entries(group).forEach(([name, val]) => {
                    if (!config.disabledTunings?.includes(name)) tunings[name] = val;
                });
            });
            if (config.customTunings) Object.assign(tunings, config.customTunings);

            const lastName = config.lastTuning;
            if (lastName && tunings[lastName]) {
                selectedTuningName = lastName;
                selectedTuning = tunings[lastName];
            } else {
                const first = Object.keys(tunings)[0];
                if (first) { selectedTuningName = first; selectedTuning = tunings[first]; }
            }

            if (tuningSelect) renderTuningOptions();
            if (uiContainer && !uiContainer.classList.contains('hidden')) renderStringNotes();
            updateFloatingButtonVisibility();
        } catch (e) {
            console.error('Tuner: Failed to load config', e);
        }
    }

    window._tunerReloadConfig = loadConfig;

    async function saveConfig() {
        try {
            await fetch('/api/plugins/tuner/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastTuning: selectedTuningName, visualizationMode }),
            });
        } catch (e) {
            console.error('Tuner: Failed to save config', e);
        }
    }

    // ── UI ────────────────────────────────────────────────────────────
    function renderTuningOptions() {
        if (!tuningSelect) return;
        tuningSelect.innerHTML = '';

        const isPlayer = document.getElementById('player')?.classList.contains('active');
        if (isPlayer && typeof window.highway?.getSongInfo === 'function') {
            const info = window.highway.getSongInfo();
            if (info && info.tuning) {
                const sc = info.stringCount || info.tuning.length;
                const realTuning = info.tuning.slice(0, sc);
                const isBass = (info.arrangement || '').toLowerCase().includes('bass');
                const freqs = window._tunerUtils.offsetsToFreqs(realTuning, isBass);
                const tName = window._tunerUtils.getTuningName(realTuning);

                const opt = document.createElement('option');
                opt.value = '_current';
                opt.textContent = `Current Song [${tName}]`;
                tuningSelect.appendChild(opt);

                if (selectedTuningName === '_current') selectedTuning = freqs;
            } else if (selectedTuningName === '_current') {
                selectedTuning = null;
            }
        } else if (selectedTuningName === '_current') {
            selectedTuning = null;
        }

        Object.keys(tunings).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            tuningSelect.appendChild(opt);
        });

        if (selectedTuningName) tuningSelect.value = selectedTuningName;
    }

    function renderStringNotes() {
        if (!stringNoteContainer) return;
        stringNoteContainer.innerHTML = '';
        if (!selectedTuning || selectedTuning.length === 0) return;

        selectedTuning.forEach(f => {
            const btn = document.createElement('button');
            btn.dataset.freq = f;
            btn.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
            btn.textContent = window._tunerUtils.midiToNote(window._tunerUtils.freqToMidi(f));
            btn.onclick = () => {
                manualTargetFreq = manualTargetFreq === f ? null : f;
                _syncStringHighlight(manualTargetFreq);
            };
            stringNoteContainer.appendChild(btn);
        });
    }

    function _syncStringHighlight(targetFreq) {
        if (!stringNoteContainer) return;
        Array.from(stringNoteContainer.children).forEach(btn => {
            const match = targetFreq !== null && Math.abs(parseFloat(btn.dataset.freq) - targetFreq) < 0.1;
            btn.className = match
                ? 'flex-1 py-1.5 text-xs font-bold rounded bg-accent text-white border border-accent transition-colors'
                : 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
        });
    }

    function _syncActiveStringFromFreq(targetFreq, isManual) {
        if (!stringNoteContainer) return;
        Array.from(stringNoteContainer.children).forEach(btn => {
            const match = Math.abs(parseFloat(btn.dataset.freq) - targetFreq) < 0.1;
            if (match) {
                btn.className = isManual
                    ? 'flex-1 py-1.5 text-xs font-bold rounded bg-accent text-white border border-accent transition-colors'
                    : 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-accent border border-accent transition-colors';
            } else {
                btn.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
            }
        });
    }

    function initUI() {
        if (uiContainer) return;
        loadSettings();

        uiContainer = document.createElement('div');
        uiContainer.id = 'tuner-plugin-ui';
        uiContainer.className = 'fixed bottom-20 right-5 w-72 bg-dark-800/95 border border-gray-800 rounded-xl p-4 text-white z-[1000] hidden flex-col items-center shadow-2xl backdrop-blur-md';

        // Header
        const header = document.createElement('div');
        header.className = 'flex justify-center items-center w-full mb-3 relative';

        const title = document.createElement('div');
        title.className = 'font-bold text-xs text-gray-500 uppercase tracking-wider';
        title.textContent = 'TUNER';
        header.appendChild(title);

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'absolute right-0 text-gray-500 hover:text-white transition-colors';
        settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
        settingsBtn.onclick = showSettings;
        header.appendChild(settingsBtn);
        uiContainer.appendChild(header);

        // Tuning selector
        tuningSelect = document.createElement('select');
        tuningSelect.className = 'w-full bg-dark-700 text-sm text-gray-200 border border-gray-800 mb-4 p-2 rounded-lg outline-none focus:border-accent transition';
        renderTuningOptions();
        tuningSelect.onchange = (e) => {
            selectedTuningName = e.target.value;
            if (selectedTuningName === '_current') {
                const info = window.highway?.getSongInfo();
                if (info) {
                    const sc = info.stringCount || info.tuning.length;
                    selectedTuning = window._tunerUtils.offsetsToFreqs(info.tuning.slice(0, sc), (info.arrangement || '').toLowerCase().includes('bass'));
                } else {
                    selectedTuning = null;
                }
            } else {
                selectedTuning = tunings[selectedTuningName];
            }
            manualTargetFreq = null;
            renderStringNotes();
            if (selectedTuningName !== '_current') saveConfig();
        };
        uiContainer.appendChild(tuningSelect);

        // String note buttons
        stringNoteContainer = document.createElement('div');
        stringNoteContainer.className = 'flex justify-between w-full mb-4 gap-1';
        uiContainer.appendChild(stringNoteContainer);
        renderStringNotes();

        // Viz container — viz modules append their DOM here
        vizContainer = document.createElement('div');
        vizContainer.className = 'w-full';
        uiContainer.appendChild(vizContainer);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'mt-5 w-full bg-dark-700 hover:bg-dark-500 border border-gray-800 text-gray-300 text-xs py-2 rounded-lg transition-colors uppercase font-semibold tracking-wide';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = disable;
        uiContainer.appendChild(closeBtn);

        document.body.appendChild(uiContainer);
    }

    // ── Settings panel ────────────────────────────────────────────────
    function showSettings() {
        let panel = uiContainer.querySelector('.tuner-settings-panel');
        if (panel) { panel.remove(); return; }

        panel = document.createElement('div');
        panel.className = 'tuner-settings-panel w-full bg-dark-700/50 border border-gray-800 rounded-lg p-3 mb-4 text-xs';
        panel.innerHTML = `
            <div class="mb-2">
                <span class="text-gray-400 font-semibold uppercase tracking-tighter">Audio Settings</span>
            </div>
            <label class="block text-gray-500 mb-1">Microphone</label>
            <select class="tuner-device-select w-full bg-dark-800 border border-gray-700 rounded px-2 py-1 text-gray-200 mb-2 outline-none focus:border-accent">
                <option value="">Default</option>
            </select>
            <label class="block text-gray-500 mb-1">Input Channel</label>
            <select class="tuner-channel-select w-full bg-dark-800 border border-gray-700 rounded px-2 py-1 text-gray-200 outline-none focus:border-accent">
                <option value="mono" ${selectedChannel === 'mono' ? 'selected' : ''}>Mono (mix both)</option>
                <option value="left" ${selectedChannel === 'left' ? 'selected' : ''}>Left (Channel 1)</option>
                <option value="right" ${selectedChannel === 'right' ? 'selected' : ''}>Right (Channel 2)</option>
            </select>
            <label class="block text-gray-500 mb-1 mt-2">Visualization</label>
            <select class="tuner-viz-select w-full bg-dark-800 border border-gray-700 rounded px-2 py-1 text-gray-200 outline-none focus:border-accent">
                <option value="default" ${visualizationMode === 'default' ? 'selected' : ''}>Default</option>
                <option value="strobe" ${visualizationMode === 'strobe' ? 'selected' : ''}>Strobe</option>
                <option value="analogue-gauge" ${visualizationMode === 'analogue-gauge' ? 'selected' : ''}>Analogue Gauge</option>
                <option value="axe-fx-iii" ${visualizationMode === 'axe-fx-iii' ? 'selected' : ''}>Axe-Fx III</option>
            </select>
        `;

        uiContainer.insertBefore(panel, tuningSelect);

        panel.querySelector('.tuner-device-select').onchange = (e) => {
            selectedDeviceId = e.target.value;
            saveSettings();
            if (enabled) restartAudio();
        };
        panel.querySelector('.tuner-channel-select').onchange = (e) => {
            selectedChannel = e.target.value;
            saveSettings();
            if (enabled) restartAudio();
        };
        panel.querySelector('.tuner-viz-select').onchange = async (e) => {
            visualizationMode = e.target.value;
            await _setVisualization(visualizationMode);
            saveConfig();
            const vizMode = manualTargetFreq ? 'manual' : (selectedTuning && selectedTuning.length > 0 ? 'auto' : 'free');
            if (activeViz) activeViz.update(null, 0, 0, vizMode);
        };

        populateDevices(panel);
    }

    async function populateDevices(panel) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const sel = panel.querySelector('.tuner-device-select');
            if (!sel) return;
            sel.innerHTML = '<option value="">Default</option>';
            for (const d of devices) {
                if (d.kind !== 'audioinput') continue;
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `Input ${d.deviceId.slice(0, 8)}`;
                if (d.deviceId === selectedDeviceId) opt.selected = true;
                sel.appendChild(opt);
            }
        } catch (e) { /* permission not yet granted */ }
    }

    // ── Audio pipeline ────────────────────────────────────────────────
    async function _startAudio() {
        const constraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 } };
        if (selectedDeviceId) constraints.audio.deviceId = { exact: selectedDeviceId };

        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            if (e.name === 'OverconstrainedError' && selectedDeviceId) {
                // Saved device may be mono-only — reset both device and channelCount.
                selectedDeviceId = '';
                saveSettings();
                delete constraints.audio.deviceId;
                delete constraints.audio.channelCount;
            } else if (e.name === 'NotFoundError' && selectedDeviceId) {
                // Saved device no longer available — fall back to default.
                selectedDeviceId = '';
                saveSettings();
                delete constraints.audio.deviceId;
            } else if (e.name === 'OverconstrainedError') {
                // No saved device, but device rejects channelCount:2.
                delete constraints.audio.channelCount;
            } else {
                throw e;
            }
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        }

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioCtx.createMediaStreamSource(stream);

        gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;

        if (sourceNode.channelCount >= 2 && selectedChannel !== 'mono') {
            const splitter = audioCtx.createChannelSplitter(2);
            const merger = audioCtx.createChannelMerger(1);
            sourceNode.connect(splitter);
            splitter.connect(merger, selectedChannel === 'left' ? 0 : 1, 0);
            merger.connect(gainNode);
        } else {
            sourceNode.connect(gainNode);
        }

        processor = audioCtx.createScriptProcessor(_TUNER_FRAME_SIZE, 1, 1);
        processor.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const combined = new Float32Array(accumBuffer.length + input.length);
            combined.set(accumBuffer);
            combined.set(input, accumBuffer.length);

            if (combined.length >= _TUNER_MIN_YIN_SAMPLES) {
                pendingBuffer = combined.slice(combined.length - _TUNER_MIN_YIN_SAMPLES);
                accumBuffer = combined.slice(input.length);
            } else {
                accumBuffer = combined;
            }
        };

        gainNode.connect(processor);
        processor.connect(audioCtx.destination);

        yinWorker = new Worker('/api/plugins/tuner/workers/yin.js');
        yinWorker.onmessage = (e) => { updateUI(e.data); processingFrame = false; };
        yinWorker.onerror = (e) => { console.error('Tuner: YIN worker error', e); processingFrame = false; };

        detectInterval = setInterval(() => {
            if (processingFrame || !pendingBuffer || !yinWorker) return;
            const buf = pendingBuffer;
            pendingBuffer = null;
            processingFrame = true;
            yinWorker.postMessage({ samples: buf, sampleRate: audioCtx.sampleRate }, [buf.buffer]);
        }, 30);
    }

    function _stopAudio() {
        if (detectInterval) { clearInterval(detectInterval); detectInterval = null; }
        if (yinWorker) { yinWorker.terminate(); yinWorker = null; }
        processingFrame = false;
        pendingBuffer = null;
        accumBuffer = new Float32Array(0);
        _freqHistory = [];
        _validFrameCount = 0;
        if (processor) { processor.disconnect(); processor = null; }
        if (gainNode) { gainNode.disconnect(); gainNode = null; }
        if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
    }

    async function restartAudio() {
        uiContainer?.querySelector('.tuner-mic-error')?.remove();
        _stopAudio();
        try {
            await _startAudio();
        } catch (e) {
            console.error('Tuner: Failed to restart audio', e);
            disable();
            _showMicError(e);
        }
    }

    async function enable() {
        if (enabled) return;
        await _loadScript('/api/plugins/tuner/utils/tuning-utils.js');
        await loadConfig();

        if (document.querySelector('.screen.active')?.id === 'player') selectedTuningName = '_current';

        initUI();
        renderTuningOptions();
        if (selectedTuningName === '_current') _syncCurrentTuning();
        else if (selectedTuning) renderStringNotes();

        await _setVisualization(visualizationMode);

        uiContainer.classList.remove('hidden');
        uiContainer.classList.add('flex');

        if (window.slopsmith && !_onScreenChanged) {
            _onScreenChanged = () => { disable(); };
            _onSongReady = () => {
                renderTuningOptions();
                if (selectedTuningName === '_current') _syncCurrentTuning();
            };
            window.slopsmith.on('screen:changed', _onScreenChanged);
            window.slopsmith.on('song:ready', _onSongReady);
        }

        uiContainer?.querySelector('.tuner-mic-error')?.remove();
        try {
            await _startAudio();
            enabled = true;
            if (window.tuner?.updateButtons) window.tuner.updateButtons();
        } catch (e) {
            console.error('Tuner: Failed to start audio', e);
            disable();
            _showMicError(e);
        }
    }

    function _showMicError(e) {
        const name = e?.name || '';
        let msg, hint;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            msg = 'Microphone access denied.';
            hint = 'On macOS open System Settings → Privacy &amp; Security → Microphone and enable your browser, then refresh the page.';
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            msg = 'No audio input found.';
            hint = 'Make sure your Real Tone Cable (or other audio input) is plugged in and recognised by macOS (check Audio MIDI Setup).';
        } else if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
            msg = 'Could not open the audio device.';
            hint = 'On macOS: (1) open Audio MIDI Setup (Applications → Utilities) and confirm the device appears with a compatible sample rate (44100 or 48000 Hz); (2) check System Settings → Privacy &amp; Security → Microphone — your browser must be listed and enabled; (3) try unplugging and replugging the cable.';
        } else {
            msg = 'Could not access microphone.';
            hint = `Error: ${name || e?.message || 'unknown'}`;
        }
        if (!uiContainer) { alert(`Tuner: ${msg}\n${hint.replace(/&amp;/g, '&')}`); return; }
        let errEl = uiContainer.querySelector('.tuner-mic-error');
        if (!errEl) {
            errEl = document.createElement('div');
            errEl.className = 'tuner-mic-error relative w-full mt-2 p-3 bg-red-900/40 border border-red-700/60 rounded-lg text-xs text-red-300 leading-relaxed';
            uiContainer.appendChild(errEl);
        }
        errEl.innerHTML = `<strong>${msg}</strong><br>${hint}`;
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'absolute top-1.5 right-2 text-red-400 hover:text-red-200 text-sm font-bold leading-none';
        dismissBtn.textContent = '×';
        dismissBtn.onclick = () => errEl.remove();
        errEl.appendChild(dismissBtn);
        uiContainer.classList.remove('hidden');
        uiContainer.classList.add('flex');
        if (window.slopsmith && !_onScreenChanged) {
            _onScreenChanged = () => { disable(); };
            window.slopsmith.on('screen:changed', _onScreenChanged);
        }
    }

    function disable() {
        enabled = false;
        manualTargetFreq = null;
        if (activeViz) { activeViz.destroy(); activeViz = null; }
        if (uiContainer) { uiContainer.classList.add('hidden'); uiContainer.classList.remove('flex'); }
        if (_onScreenChanged) { window.slopsmith?.off('screen:changed', _onScreenChanged); _onScreenChanged = null; }
        if (_onSongReady) { window.slopsmith?.off('song:ready', _onSongReady); _onSongReady = null; }
        _stopAudio();
        if (vizContainer) vizContainer.innerHTML = '';
        if (window.tuner?.updateButtons) window.tuner.updateButtons();
    }

    // ── UI update (called from detection loop) ────────────────────────
    function updateUI(result) {
        const rms = result ? result.rms : 0;
        const vizMode = manualTargetFreq ? 'manual' : (selectedTuning && selectedTuning.length > 0 ? 'auto' : 'free');

        const hasSignal = rms > 0.01;

        if (!result || (!hasSignal && result.confidence < 0.5) || (result.freq < _TUNER_MIN_DETECTABLE_HZ && result.freq !== 0)) {
            _validFrameCount = 0;
            _freqHistory = [];
            if (activeViz) activeViz.update(null, 0, 0, vizMode);
            _syncStringHighlight(manualTargetFreq);
            return;
        }

        if (result.confidence < 0.5 && hasSignal) {
            // dim signal — let viz handle its own timeout
            _validFrameCount = 0;
            _freqHistory = [];
            if (activeViz) activeViz.update(null, 0, 0, vizMode);
            _syncStringHighlight(manualTargetFreq);
            return;
        }

        // Valid signal: push raw YIN freq into median history.
        _freqHistory.push(result.freq);
        if (_freqHistory.length > _FREQ_HISTORY_LEN) _freqHistory.shift();

        // Skip the pluck-attack transient — keep filling history but hold the
        // display until a few consecutive valid frames have settled the pitch.
        _validFrameCount++;
        if (_validFrameCount <= _WARMUP_FRAMES) {
            if (activeViz) activeViz.update(null, 0, 0, vizMode);
            _syncStringHighlight(manualTargetFreq);
            return;
        }

        const freq = _median(_freqHistory);

        let targetFreq;
        let isManual = false;
        if (manualTargetFreq) {
            targetFreq = manualTargetFreq;
            isManual = true;
        } else if (selectedTuning && selectedTuning.length > 0) {
            targetFreq = selectedTuning.reduce((best, f) => Math.abs(freq - f) < Math.abs(freq - best) ? f : best, selectedTuning[0]);
        } else {
            targetFreq = window._tunerUtils.midiToFreq(Math.round(window._tunerUtils.freqToMidi(freq)));
        }

        const cents = (window._tunerUtils.freqToMidi(freq) - window._tunerUtils.freqToMidi(targetFreq)) * 100;
        const note = window._tunerUtils.midiToNote(window._tunerUtils.freqToMidi(targetFreq));

        if (activeViz) activeViz.update(note, cents, freq, vizMode, targetFreq);
        _syncActiveStringFromFreq(targetFreq, isManual);
    }

    // ── Button management ─────────────────────────────────────────────
    function updateFloatingButtonVisibility() {
        const btn = document.getElementById('tuner-toggle-btn');
        if (!btn) return;
        const isPlayer = document.querySelector('.screen.active')?.id === 'player';
        if (!showFloatingButton || isPlayer || window.slopsmith?.isPlaying) {
            btn.classList.add('hidden');
        } else {
            btn.classList.remove('hidden');
        }
    }

    function updateFloatingButton() {
        const btn = document.getElementById('tuner-toggle-btn');
        if (!btn) return;
        const isHidden = btn.classList.contains('hidden');
        btn.className = enabled
            ? 'fixed bottom-5 right-5 px-4 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent text-accent rounded-xl text-sm transition-all duration-200 active:scale-95 shadow-2xl z-[1001]'
            : 'fixed bottom-5 right-5 px-4 py-2.5 bg-dark-700 hover:bg-dark-500 border border-gray-800 text-gray-300 hover:text-white rounded-xl text-sm transition-all duration-200 active:scale-95 shadow-2xl z-[1001]';
        if (isHidden) btn.classList.add('hidden');
        updateFloatingButtonVisibility();
    }

    function updatePlayerButton() {
        const btn = document.getElementById('btn-tuner-player');
        if (!btn) return;
        btn.className = enabled
            ? 'px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent rounded-lg text-xs text-accent transition'
            : 'px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded-lg text-xs text-gray-400 transition';
    }

    window.tuner = {
        enable,
        disable,
        toggle: () => enabled ? disable() : enable(),
        updateButtons: () => { updateFloatingButton(); updatePlayerButton(); updateFloatingButtonVisibility(); },
    };

    function addButton() {
        if (document.getElementById('tuner-toggle-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'tuner-toggle-btn';
        btn.textContent = 'Tuner';
        btn.title = 'Open Tuner';
        btn.onclick = window.tuner.toggle;
        document.body.appendChild(btn);
        updateFloatingButton();
        updateFloatingButtonVisibility();

        const handlePlay = () => {
            updateFloatingButtonVisibility();
            if (enabled) disable();
        };
        const handleStop = () => updateFloatingButtonVisibility();

        if (window.slopsmith) {
            window.slopsmith.on('song:play', handlePlay);
            window.slopsmith.on('song:pause', handleStop);
            window.slopsmith.on('song:ended', handleStop);
            window.slopsmith.on('screen:changed', (e) => {
                if (e.detail.id === 'player') { handlePlay(); injectPlayerButton(); }
                else handleStop();
            });

            if (window.slopsmith.isPlaying || document.querySelector('.screen.active')?.id === 'player') {
                handlePlay();
                if (document.querySelector('.screen.active')?.id === 'player') injectPlayerButton();
            } else {
                updateFloatingButtonVisibility();
            }
        }
    }

    function injectPlayerButton() {
        const controls = document.getElementById('player-controls');
        if (!controls || document.getElementById('btn-tuner-player')) return;

        const btn = document.createElement('button');
        btn.id = 'btn-tuner-player';
        btn.textContent = 'Tuner';
        btn.title = 'Open Tuner';
        btn.onclick = window.tuner.toggle;
        const closeBtn = controls.querySelector('button:last-child');
        if (closeBtn) controls.insertBefore(btn, closeBtn);
        else controls.appendChild(btn);
        updatePlayerButton();
    }

    _loadScript('/api/plugins/tuner/utils/tuning-utils.js').catch(e => console.error(e));
    console.log('Tuner plugin loaded. Use window.tuner.toggle() to open.');
    addButton();

})();
