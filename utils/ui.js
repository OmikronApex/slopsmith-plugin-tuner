window._tunerUI = function(state, actions) {
    const _INSTRUMENT_DISPLAY = {
        'guitar-6': 'Guitar (6)', 'guitar-7': 'Guitar (7)', 'guitar-8': 'Guitar (8)',
        'bass-4': 'Bass (4)', 'bass-5': 'Bass (5)',
    };

    function _freqsEqual(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        return a.every(function(f, i) { return Math.round(f * 100) === Math.round(b[i] * 100); });
    }

    function _tuningAlreadyKnown(freqs) {
        if (!freqs || !freqs.length) return false;
        const instrument = state.selectedInstrument;
        if (state.defaultTunings[instrument]) {
            for (var name in state.defaultTunings[instrument]) {
                if (_freqsEqual(freqs, state.defaultTunings[instrument][name])) return true;
            }
        }
        if (state._serverConfig) {
            for (var cname in (state._serverConfig.customTunings || {})) {
                var val = state._serverConfig.customTunings[cname];
                var inst = Array.isArray(val) ? 'guitar-6' : (val.instrument || 'guitar-6');
                if (inst !== instrument) continue;
                var strings = Array.isArray(val) ? val : (val.strings || []);
                if (_freqsEqual(freqs, strings)) return true;
            }
        }
        return false;
    }

    function _updateInstrumentDisplay() {
        if (state._instrumentSentinel) {
            state._instrumentSentinel.textContent = _INSTRUMENT_DISPLAY[state.selectedInstrument] || state.selectedInstrument;
            if (state.instrumentSelect) state.instrumentSelect.value = '__display__';
        }
    }

    function _syncStringHighlight(targetFreq) {
        if (!state.stringNoteContainer) return;
        Array.from(state.stringNoteContainer.children).forEach(btn => {
            const match = targetFreq !== null && Math.abs(parseFloat(btn.dataset.freq) - targetFreq) < 0.1;
            btn.className = match
                ? 'flex-1 py-1.5 text-xs font-bold rounded bg-accent text-white border border-accent transition-colors'
                : 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
        });
    }

    function _syncActiveStringFromFreq(targetFreq, isManual) {
        if (!state.stringNoteContainer) return;
        Array.from(state.stringNoteContainer.children).forEach(btn => {
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

    function _updateSaveAsCustomVisibility() {
        if (!state.saveAsCustomContainer) return;
        const show = state.selectedTuningName === '_current'
            && state.selectedTuning
            && state.selectedTuning.length > 0
            && !_tuningAlreadyKnown(state.selectedTuning);
        if (show) {
            state.saveAsCustomContainer.classList.remove('hidden');
        } else {
            state.saveAsCustomContainer.classList.add('hidden');
            const inp = state.saveAsCustomContainer.querySelector('.tuner-save-inline');
            if (inp) inp.remove();
        }
    }

    function _showSaveAsCustomInput() {
        if (state.saveAsCustomContainer.querySelector('.tuner-save-inline')) return;

        const labelBtn = state.saveAsCustomContainer.querySelector('.tuner-save-label');
        if (labelBtn) labelBtn.classList.add('hidden');

        const inline = document.createElement('div');
        inline.className = 'tuner-save-inline flex gap-2 w-full';

        const suggestedName = (state.currentSongOffsets && window._tunerUtils)
            ? (window._tunerUtils.getTuningName(state.currentSongOffsets) || 'Custom Tuning')
            : 'Custom Tuning';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = suggestedName;
        nameInput.className = 'flex-1 bg-dark-700 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-accent';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Save';
        confirmBtn.className = 'bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent text-xs px-3 py-1 rounded transition-colors';

        const doSave = async () => {
            const name = nameInput.value.trim();
            if (!name || !state.selectedTuning || state.selectedTuning.length === 0) return;
            const rounded = state.selectedTuning.map(f => Math.round(f * 100) / 100);
            const sc = rounded.length;
            const instrument = (sc === 4 || sc === 5)
                ? (state.currentSongIsBass ? 'bass-' + sc : 'guitar-6')
                : (sc === 7 ? 'guitar-7' : sc === 8 ? 'guitar-8' : 'guitar-6');
            try {
                const config = await fetch('/api/plugins/tuner/config').then(r => r.json());
                const custom = config.customTunings || {};
                custom[name] = { instrument, strings: rounded };
                await fetch('/api/plugins/tuner/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customTunings: custom }),
                });
                state.selectedInstrument = instrument;
                state.selectedTuningName = name;
                state.selectedTuning = rounded;
                _updateInstrumentDisplay();
                await actions.loadConfig();
                state.selectedTuningName = name;
                state.selectedTuning = state.tunings[name] || rounded;
                if (state.tuningSelect) state.tuningSelect.value = name;
                renderStringNotes();
                actions.saveConfig();
            } catch (e) {
                console.error('Tuner: Failed to save custom tuning', e);
            }
        };

        confirmBtn.onclick = doSave;
        nameInput.onkeydown = (e) => { if (e.key === 'Enter') doSave(); };

        inline.appendChild(nameInput);
        inline.appendChild(confirmBtn);
        state.saveAsCustomContainer.appendChild(inline);
        nameInput.focus();
        nameInput.select();
    }

    function renderInstrumentOptions() {
        if (!state.instrumentSelect) return;
        state.instrumentSelect.innerHTML = '';

        state._instrumentSentinel = document.createElement('option');
        state._instrumentSentinel.value = '__display__';
        state._instrumentSentinel.textContent = _INSTRUMENT_DISPLAY[state.selectedInstrument] || state.selectedInstrument;
        state._instrumentSentinel.style.display = 'none';
        state.instrumentSelect.appendChild(state._instrumentSentinel);

        const guitarGroup = document.createElement('optgroup');
        guitarGroup.label = 'Guitar';
        [['guitar-6', '6-string'], ['guitar-7', '7-string'], ['guitar-8', '8-string']].forEach(([val, label]) => {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = label;
            guitarGroup.appendChild(opt);
        });

        const bassGroup = document.createElement('optgroup');
        bassGroup.label = 'Bass';
        [['bass-4', '4-string'], ['bass-5', '5-string']].forEach(([val, label]) => {
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = label;
            bassGroup.appendChild(opt);
        });

        state.instrumentSelect.appendChild(guitarGroup);
        state.instrumentSelect.appendChild(bassGroup);
        state.instrumentSelect.value = '__display__';
    }

    function renderTuningOptions() {
        if (!state.tuningSelect) return;
        state.tuningSelect.innerHTML = '';

        const isPlayer = document.getElementById('player')?.classList.contains('active');
        if (isPlayer && typeof window.highway?.getSongInfo === 'function') {
            const info = window.highway.getSongInfo();
            if (info && info.tuning) {
                const sc = info.stringCount || info.tuning.length;
                const isBass = (info.arrangement || '').toLowerCase().includes('bass');
                const freqs = window._tunerUtils.offsetsToFreqs(info.tuning.slice(0, sc), isBass);
                const tName = window._tunerUtils.getTuningName(info.tuning.slice(0, sc));

                const opt = document.createElement('option');
                opt.value = '_current';
                opt.textContent = `Current Song [${tName}]`;
                state.tuningSelect.appendChild(opt);

                if (state.selectedTuningName === '_current') state.selectedTuning = freqs;
            } else if (state.selectedTuningName === '_current') {
                state.selectedTuning = null;
            }
        } else if (state.selectedTuningName === '_current') {
            state.selectedTuning = null;
        }

        const freeTuneOpt = document.createElement('option');
        freeTuneOpt.value = 'free-tune';
        freeTuneOpt.textContent = 'Free Tune';
        state.tuningSelect.appendChild(freeTuneOpt);

        Object.keys(state.tunings).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            state.tuningSelect.appendChild(opt);
        });

        if (state.selectedTuningName) state.tuningSelect.value = state.selectedTuningName;
    }

    function renderStringNotes() {
        if (!state.stringNoteContainer) return;
        state.stringNoteContainer.innerHTML = '';
        if (!state.selectedTuning || state.selectedTuning.length === 0) return;

        state.selectedTuning.forEach(f => {
            const btn = document.createElement('button');
            btn.dataset.freq = f;
            btn.className = 'flex-1 py-1.5 text-xs font-bold rounded bg-dark-700 text-gray-400 border border-gray-800 hover:border-gray-600 transition-colors';
            btn.textContent = window._tunerUtils.midiToNote(window._tunerUtils.freqToMidi(f));
            btn.onclick = () => {
                state.manualTargetFreq = state.manualTargetFreq === f ? null : f;
                _syncStringHighlight(state.manualTargetFreq);
            };
            state.stringNoteContainer.appendChild(btn);
        });
    }

    function updateUI(result) {
        const { smoothedFreq, rms, hasSignal } = result;
        const vizMode = state.manualTargetFreq ? 'manual' : (state.selectedTuning && state.selectedTuning.length > 0 ? 'auto' : 'free');

        if (smoothedFreq === null) {
            if (state.activeViz) state.activeViz.update(null, 0, 0, vizMode);
            _syncStringHighlight(state.manualTargetFreq);
            return;
        }

        let targetFreq, isManual = false;
        if (state.manualTargetFreq) {
            targetFreq = state.manualTargetFreq;
            isManual = true;
        } else if (state.selectedTuning && state.selectedTuning.length > 0) {
            targetFreq = state.selectedTuning.reduce(
                (best, f) => Math.abs(smoothedFreq - f) < Math.abs(smoothedFreq - best) ? f : best,
                state.selectedTuning[0]
            );
        } else {
            targetFreq = window._tunerUtils.midiToFreq(Math.round(window._tunerUtils.freqToMidi(smoothedFreq)));
        }

        const cents = (window._tunerUtils.freqToMidi(smoothedFreq) - window._tunerUtils.freqToMidi(targetFreq)) * 100;
        const note = window._tunerUtils.midiToNote(window._tunerUtils.freqToMidi(targetFreq));

        if (state.activeViz) state.activeViz.update(note, cents, smoothedFreq, vizMode, targetFreq);
        _syncActiveStringFromFreq(targetFreq, isManual);
    }

    function updateFloatingButtonVisibility() {
        const btn = document.getElementById('tuner-toggle-btn');
        if (!btn) return;
        const isPlayer = document.querySelector('.screen.active')?.id === 'player';
        if (!state.showFloatingButton || isPlayer || window.slopsmith?.isPlaying) {
            btn.classList.add('hidden');
        } else {
            btn.classList.remove('hidden');
        }
    }

    function updateFloatingButton() {
        const btn = document.getElementById('tuner-toggle-btn');
        if (!btn) return;
        const isHidden = btn.classList.contains('hidden');
        btn.className = state.enabled
            ? 'fixed bottom-5 right-5 px-4 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent text-accent rounded-xl text-sm transition-all duration-200 active:scale-95 shadow-2xl z-[1001]'
            : 'fixed bottom-5 right-5 px-4 py-2.5 bg-dark-700 hover:bg-dark-500 border border-gray-800 text-gray-300 hover:text-white rounded-xl text-sm transition-all duration-200 active:scale-95 shadow-2xl z-[1001]';
        if (isHidden) btn.classList.add('hidden');
        updateFloatingButtonVisibility();
    }

    function updatePlayerButton() {
        const btn = document.getElementById('btn-tuner-player');
        if (!btn) return;
        btn.className = state.enabled
            ? 'px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent rounded-lg text-xs text-accent transition'
            : 'px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded-lg text-xs text-gray-400 transition';
    }

    function showSettings() {
        let panel = state.uiContainer.querySelector('.tuner-settings-panel');
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
                <option value="mono" ${state.selectedChannel === 'mono' ? 'selected' : ''}>Mono (mix both)</option>
                <option value="left" ${state.selectedChannel === 'left' ? 'selected' : ''}>Left (Channel 1)</option>
                <option value="right" ${state.selectedChannel === 'right' ? 'selected' : ''}>Right (Channel 2)</option>
            </select>
            <label class="block text-gray-500 mb-1 mt-2">Visualization</label>
            <select class="tuner-viz-select w-full bg-dark-800 border border-gray-700 rounded px-2 py-1 text-gray-200 outline-none focus:border-accent">
                <option value="default" ${state.visualizationMode === 'default' ? 'selected' : ''}>Default</option>
                <option value="strobe" ${state.visualizationMode === 'strobe' ? 'selected' : ''}>Strobe</option>
                <option value="analogue-gauge" ${state.visualizationMode === 'analogue-gauge' ? 'selected' : ''}>Analogue Gauge</option>
                <option value="mace-fx-iii" ${state.visualizationMode === 'mace-fx-iii' ? 'selected' : ''}>Mace Fx III</option>
                <option value="pp-tiny" ${state.visualizationMode === 'pp-tiny' ? 'selected' : ''}>Bender PP-Tiny</option>
                <option value="chef-mt3" ${state.visualizationMode === 'chef-mt3' ? 'selected' : ''}>CHEF MT-3</option>
                <option value="toilet-tuner" ${state.visualizationMode === 'toilet-tuner' ? 'selected' : ''}>Toilet Tuner</option>
            </select>
        `;

        state.uiContainer.insertBefore(panel, state.uiContainer.querySelector('.flex.gap-2'));

        panel.querySelector('.tuner-device-select').onchange = (e) => {
            state.selectedDeviceId = e.target.value;
            actions.saveSettings();
            if (state.enabled) actions.restartAudio();
        };
        panel.querySelector('.tuner-channel-select').onchange = (e) => {
            state.selectedChannel = e.target.value;
            actions.saveSettings();
            if (state.enabled) actions.restartAudio();
        };
        panel.querySelector('.tuner-viz-select').onchange = async (e) => {
            state.visualizationMode = e.target.value;
            await actions.setVisualization(state.visualizationMode);
            actions.saveConfig();
            const vizMode = state.manualTargetFreq ? 'manual' : (state.selectedTuning && state.selectedTuning.length > 0 ? 'auto' : 'free');
            if (state.activeViz) state.activeViz.update(null, 0, 0, vizMode);
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
                if (d.deviceId === state.selectedDeviceId) opt.selected = true;
                sel.appendChild(opt);
            }
        } catch (e) { /* permission not yet granted */ }
    }

    function showMicError(e) {
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
        if (!state.uiContainer) { alert(`Tuner: ${msg}\n${hint.replace(/&amp;/g, '&')}`); return; }
        let errEl = state.uiContainer.querySelector('.tuner-mic-error');
        if (!errEl) {
            errEl = document.createElement('div');
            errEl.className = 'tuner-mic-error relative w-full mt-2 p-3 bg-red-900/40 border border-red-700/60 rounded-lg text-xs text-red-300 leading-relaxed';
            state.uiContainer.appendChild(errEl);
        }
        errEl.innerHTML = `<strong>${msg}</strong><br>${hint}`;
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'absolute top-1.5 right-2 text-red-400 hover:text-red-200 text-sm font-bold leading-none';
        dismissBtn.textContent = '×';
        dismissBtn.onclick = () => errEl.remove();
        errEl.appendChild(dismissBtn);
        state.uiContainer.classList.remove('hidden');
        state.uiContainer.classList.add('flex');
    }

    function initUI() {
        if (state.uiContainer) return;

        state.uiContainer = document.createElement('div');
        state.uiContainer.id = 'tuner-plugin-ui';
        state.uiContainer.className = 'fixed bottom-20 right-5 w-72 bg-dark-800/95 border border-gray-800 rounded-xl p-4 text-white z-[1000] hidden flex-col items-center shadow-2xl backdrop-blur-md';

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
        state.uiContainer.appendChild(header);

        const selectorRow = document.createElement('div');
        selectorRow.className = 'flex gap-2 w-full mb-4';

        state.instrumentSelect = document.createElement('select');
        state.instrumentSelect.className = 'flex-none bg-dark-700 text-sm text-gray-200 border border-gray-800 p-2 rounded-lg outline-none focus:border-accent transition';

        renderInstrumentOptions();
        state.instrumentSelect.onchange = (e) => {
            state.selectedInstrument = e.target.value;
            _updateInstrumentDisplay();
            state.manualTargetFreq = null;

            state.tunings = actions.buildTuningsForInstrument(state.selectedInstrument);

            const firstTuning = Object.keys(state.tunings)[0] || null;
            state.selectedTuningName = firstTuning || 'free-tune';
            state.selectedTuning = firstTuning ? state.tunings[firstTuning] : [];

            renderTuningOptions();
            renderStringNotes();
            _updateSaveAsCustomVisibility();
            actions.saveConfig();
        };
        selectorRow.appendChild(state.instrumentSelect);

        state.tuningSelect = document.createElement('select');
        state.tuningSelect.className = 'flex-1 min-w-0 bg-dark-700 text-sm text-gray-200 border border-gray-800 p-2 rounded-lg outline-none focus:border-accent transition';
        renderTuningOptions();
        state.tuningSelect.onchange = (e) => {
            state.selectedTuningName = e.target.value;
            if (state.selectedTuningName === '_current') {
                const info = window.highway?.getSongInfo();
                if (info) {
                    const sc = info.stringCount || info.tuning.length;
                    const isBass = (info.arrangement || '').toLowerCase().includes('bass');
                    state.currentSongOffsets = info.tuning.slice(0, sc);
                    state.currentSongIsBass = isBass;
                    state.selectedTuning = window._tunerUtils.offsetsToFreqs(state.currentSongOffsets, isBass);
                } else {
                    state.selectedTuning = null;
                }
            } else if (state.selectedTuningName === 'free-tune') {
                state.selectedTuning = [];
            } else {
                state.selectedTuning = state.tunings[state.selectedTuningName];
            }
            state.manualTargetFreq = null;
            renderStringNotes();
            _updateSaveAsCustomVisibility();
            if (state.selectedTuningName !== '_current' && state.selectedTuningName !== 'free-tune') actions.saveConfig();
        };
        selectorRow.appendChild(state.tuningSelect);
        state.uiContainer.appendChild(selectorRow);

        state.stringNoteContainer = document.createElement('div');
        state.stringNoteContainer.className = 'flex justify-between w-full mb-4 gap-1';
        state.uiContainer.appendChild(state.stringNoteContainer);
        renderStringNotes();

        state.saveAsCustomContainer = document.createElement('div');
        state.saveAsCustomContainer.className = 'w-full mb-3 hidden';

        const labelBtn = document.createElement('button');
        labelBtn.className = 'tuner-save-label w-full text-[11px] text-accent/70 hover:text-accent border border-accent/20 hover:border-accent/50 rounded-lg py-1.5 transition-colors';
        labelBtn.textContent = 'Save as Custom Tuning';
        labelBtn.onclick = _showSaveAsCustomInput;
        state.saveAsCustomContainer.appendChild(labelBtn);
        state.uiContainer.appendChild(state.saveAsCustomContainer);

        state.vizContainer = document.createElement('div');
        state.vizContainer.className = 'w-full';
        state.uiContainer.appendChild(state.vizContainer);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'mt-5 w-full bg-dark-700 hover:bg-dark-500 border border-gray-800 text-gray-300 text-xs py-2 rounded-lg transition-colors uppercase font-semibold tracking-wide';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = actions.disable;
        state.uiContainer.appendChild(closeBtn);

        document.body.appendChild(state.uiContainer);
    }

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
            if (state.enabled) actions.disable();
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

    return {
        initUI,
        renderInstrumentOptions,
        renderTuningOptions,
        renderStringNotes,
        updateUI,
        updateInstrumentDisplay: _updateInstrumentDisplay,
        updateSaveAsCustomVisibility: _updateSaveAsCustomVisibility,
        updateFloatingButton,
        updatePlayerButton,
        updateFloatingButtonVisibility,
        showMicError,
        addButton,
        injectPlayerButton,
    };
};
