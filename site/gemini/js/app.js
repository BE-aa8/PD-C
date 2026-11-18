import { DATA } from './data.js';
import {
  DEFAULT_INPUTS,
  linearModel,
  nonlinearGain,
  halfRule,
  imcTuning,
  margins,
  simulate,
  metrics
} from './model.js';

// State management
let currentInputs = { ...DEFAULT_INPUTS };
let currentSimResult = null;
let currentMetrics = null;
let savedRuns = [];
let mpcMode = 'unannounced'; // 'unannounced' | 'announced'
let isDarkTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for theme changes
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    isDarkTheme = e.matches;
    renderAllPlots();
  });
}

function getPlotTheme() {
  return {
    paper_bgcolor: isDarkTheme ? '#131b2e' : '#ffffff',
    plot_bgcolor: isDarkTheme ? '#0b1120' : '#f8fafc',
    font: {
      color: isDarkTheme ? '#f1f5f9' : '#0f172a',
      family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      size: 11
    },
    gridcolor: isDarkTheme ? '#1e2945' : '#e2e8f0',
    zerolinecolor: isDarkTheme ? '#33446b' : '#cbd5e1'
  };
}

function fmt(val, dec = 1, fallback = '-') {
  if (val === null || val === undefined || Number.isNaN(val) || !Number.isFinite(val)) {
    return fallback;
  }
  return Number(val).toFixed(dec);
}

// -------------------------------------------------------------
// DOM Ready & Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initKaTeX();
  initTabs();
  bindControls();
  applyPreset('ex23_6e_feedback_only');
  initStaticCharts();
});

// -------------------------------------------------------------
// KaTeX Rendering
// -------------------------------------------------------------
function initKaTeX() {
  if (typeof window.katex === 'undefined') return;
  document.querySelectorAll('.katex-render').forEach((el) => {
    const tex = el.getAttribute('data-tex');
    if (tex) {
      try {
        window.katex.render(tex, el, { displayMode: true, throwOnError: false });
      } catch (err) {
        console.error('KaTeX error:', err);
      }
    }
  });
}

// -------------------------------------------------------------
// Tab Switching
// -------------------------------------------------------------
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(targetId);
      if (panel) {
        panel.classList.add('active');
      }

      // Trigger resize on visible plots
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        document.querySelectorAll('.js-plotly-plot').forEach((p) => {
          if (p.offsetParent !== null) {
            window.Plotly.Plots.resize(p);
          }
        });
      }, 50);
    });
  });
}

// -------------------------------------------------------------
// Presets Definition
// -------------------------------------------------------------
const PRESETS = {
  ex23_6e_feedback_only: {
    label: 'Default Ex. 23.6e',
    inputs: { ...DEFAULT_INPUTS }
  },
  open_loop_meal_at_0: {
    label: 'Open Loop',
    inputs: { ...DEFAULT_INPUTS, controller: 'none', meals: [[0.0, 1.0]], t_end: 600.0, sensor_delay: 0.0 }
  },
  ex23_6d_no_delay: {
    label: 'Ideal Sensor (No delay)',
    inputs: { ...DEFAULT_INPUTS, sensor_delay: 0.0, ...imcTuning({ model: 'fit_sopdt', theta_sensor: 0.0, tau_c: 20.0 }) }
  },
  delay_unaware_tuning: {
    label: 'Delay-Unaware Tuning',
    inputs: { ...DEFAULT_INPUTS, ...imcTuning({ model: 'fit_sopdt', theta_sensor: 0.0, tau_c: 20.0 }) }
  },
  aggressive_tau_c_2: {
    label: 'Aggressive tau_c = 2',
    inputs: { ...DEFAULT_INPUTS, ...imcTuning({ model: 'fit_sopdt', theta_sensor: 10.0, tau_c: 2.0 }) }
  },
  bolus_at_meal: {
    label: 'Feedforward Bolus at meal',
    inputs: { ...DEFAULT_INPUTS, ff_enabled: true }
  },
  prebolus_15: {
    label: '15-min Pre-bolus',
    inputs: { ...DEFAULT_INPUTS, ff_enabled: true, t_pre: 15.0 }
  },
  overestimate_40: {
    label: '+40% Meal Overestimate',
    inputs: { ...DEFAULT_INPUTS, ff_enabled: true, t_pre: 15.0, est_error: 0.4 }
  },
  windup_off_2x: {
    label: 'Anti-windup off (2x meal)',
    inputs: { ...DEFAULT_INPUTS, anti_windup: 'off', meals: [[60.0, 2.0]] }
  },
  windup_clamp_2x: {
    label: 'Clamping (2x meal)',
    inputs: { ...DEFAULT_INPUTS, anti_windup: 'clamp', meals: [[60.0, 2.0]] }
  },
  windup_backcalc_2x: {
    label: 'Back-calculation (2x meal)',
    inputs: { ...DEFAULT_INPUTS, anti_windup: 'backcalc', meals: [[60.0, 2.0]] }
  },
  sp_step_minus20: {
    label: 'Set-point step -20',
    inputs: { ...DEFAULT_INPUTS, meals: [], setpoint_steps: [[60.0, 61.0]], beta: 1.0 }
  },
  sp_step_minus20_beta_half: {
    label: 'Set-point step -20 (beta=0.5)',
    inputs: { ...DEFAULT_INPUTS, meals: [], setpoint_steps: [[60.0, 61.0]], beta: 0.5 }
  },
  p_only_offset: {
    label: 'P-only Mode',
    inputs: { ...DEFAULT_INPUTS, meals: [], mode: 'P', setpoint_steps: [[60.0, 61.0]] }
  },
  pi_mode: {
    label: 'PI Mode',
    inputs: { ...DEFAULT_INPUTS, mode: 'PI' }
  },
  sensor_lag_5: {
    label: 'Sensor Lag 5 min',
    inputs: { ...DEFAULT_INPUTS, sensor_lag: 5.0 }
  },
  sensor_stuck_60: {
    label: 'Stuck Sensor',
    inputs: { ...DEFAULT_INPUTS, fault: 'stuck', t_fault: 60.0 }
  },
  sensor_drift: {
    label: 'Sensor Drift',
    inputs: { ...DEFAULT_INPUTS, fault: 'drift', t_fault: 60.0, drift_rate: 10.0 }
  },
  sensor_dropout: {
    label: 'Sensor Dropout',
    inputs: { ...DEFAULT_INPUTS, fault: 'dropout', t_fault: 100.0, dropout_duration: 30.0 }
  },
  sensitivity_change: {
    label: 'Sensitivity x1.5',
    inputs: { ...DEFAULT_INPUTS, sensitivity_change: [120.0, 1.5] }
  },
  three_meals_24h: {
    label: 'Three Meals 24h',
    inputs: { ...DEFAULT_INPUTS, t_end: 1440.0, meals: [[480.0, 1.0], [780.0, 1.0], [1140.0, 1.0]] }
  },
  suspend_integral: {
    label: 'Suspend Integral',
    inputs: { ...DEFAULT_INPUTS, ff_enabled: true, t_pre: 15.0, suspend_integral: true, suspend_extra: 60.0 }
  }
};

function applyPreset(presetKey) {
  const p = PRESETS[presetKey];
  if (!p) return;

  currentInputs = { ...DEFAULT_INPUTS, ...p.inputs };
  syncControlsFromInputs();
  runSimulationAndUpdateUI();
}

// -------------------------------------------------------------
// Bind UI Controls
// -------------------------------------------------------------
function bindControls() {
  // Preset select
  const selectPreset = document.getElementById('select-preset');
  if (selectPreset) {
    selectPreset.addEventListener('change', (e) => {
      applyPreset(e.target.value);
    });
  }

  // Controller mode toggles
  ['pid', 'pi', 'p'].forEach((m) => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-toggle[data-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentInputs.mode = btn.getAttribute('data-mode');
        updateModeVisibility();
        runSimulationAndUpdateUI();
      });
    }
  });

  // Range sliders
  bindSlider('slider-setpoint', 'val-setpoint', (v) => {
    currentInputs.setpoint = parseFloat(v);
    // Show beta slider if setpoint deviates from 81
    const groupBeta = document.getElementById('group-setpoint-weight');
    if (groupBeta) {
      groupBeta.style.display = (Math.abs(currentInputs.setpoint - 81) > 0.1 || (currentInputs.setpoint_steps && currentInputs.setpoint_steps.length > 0)) ? 'flex' : 'none';
    }
    return `${fmt(v, 0)} mg/dL`;
  });

  bindSlider('slider-kc', 'val-kc', (v) => {
    currentInputs.Kc = parseFloat(v);
    return fmt(v, 3);
  });

  bindSlider('slider-tau-i', 'val-tau-i', (v) => {
    currentInputs.tauI = parseFloat(v);
    return `${fmt(v, 1)} min`;
  });

  bindSlider('slider-tau-d', 'val-tau-d', (v) => {
    currentInputs.tauD = parseFloat(v);
    return `${fmt(v, 1)} min`;
  });

  bindSlider('slider-filter-n', 'val-filter-n', (v) => {
    currentInputs.N = parseFloat(v);
    return fmt(v, 0);
  });

  bindSlider('slider-beta', 'val-beta', (v) => {
    currentInputs.beta = parseFloat(v);
    return fmt(v, 2);
  });

  bindSlider('slider-sensor-delay', 'val-sensor-delay', (v) => {
    currentInputs.sensor_delay = parseFloat(v);
    return `${fmt(v, 0)} min`;
  });

  bindSlider('slider-sensor-lag', 'val-sensor-lag', (v) => {
    currentInputs.sensor_lag = parseFloat(v);
    return `${fmt(v, 1)} min`;
  });

  bindSlider('slider-sensor-noise', 'val-sensor-noise', (v) => {
    currentInputs.noise_sd = parseFloat(v);
    return `${fmt(v, 1)} mg/dL`;
  });

  bindSlider('slider-meal-mult', 'val-meal-mult', (v) => {
    const mult = parseFloat(v);
    currentInputs.meals = [[60.0, mult]];
    return `${fmt(v, 1)}x`;
  });

  bindSlider('slider-f-bolus', 'val-f-bolus', (v) => {
    currentInputs.f_bolus = parseFloat(v);
    return fmt(v, 2);
  });

  bindSlider('slider-t-pre', 'val-t-pre', (v) => {
    currentInputs.t_pre = parseFloat(v);
    return `${fmt(v, 0)} min`;
  });

  bindSlider('slider-est-error', 'val-est-error', (v) => {
    currentInputs.est_error = parseFloat(v);
    return `${Math.round(parseFloat(v) * 100)}%`;
  });

  bindSlider('slider-suspend-extra', 'val-suspend-extra', (v) => {
    currentInputs.suspend_extra = parseFloat(v);
    return `${fmt(v, 0)} min`;
  });

  // Anti-windup select
  const selectAntiwindup = document.getElementById('select-antiwindup');
  if (selectAntiwindup) {
    selectAntiwindup.addEventListener('change', (e) => {
      currentInputs.anti_windup = e.target.value;
      runSimulationAndUpdateUI();
    });
  }

  // Fault select
  const selectFault = document.getElementById('select-fault');
  if (selectFault) {
    selectFault.addEventListener('change', (e) => {
      currentInputs.fault = e.target.value;
      if (currentInputs.fault === 'drift') {
        currentInputs.drift_rate = 10.0;
      } else if (currentInputs.fault === 'dropout') {
        currentInputs.dropout_duration = 30.0;
      }
      runSimulationAndUpdateUI();
    });
  }

  // Checkboxes
  const checkFF = document.getElementById('check-ff');
  if (checkFF) {
    checkFF.addEventListener('change', (e) => {
      currentInputs.ff_enabled = e.target.checked;
      const ffGroup = document.getElementById('group-ff-sliders');
      if (ffGroup) {
        ffGroup.style.display = e.target.checked ? 'flex' : 'none';
      }
      runSimulationAndUpdateUI();
    });
  }

  const checkSuspendInt = document.getElementById('check-suspend-int');
  if (checkSuspendInt) {
    checkSuspendInt.addEventListener('change', (e) => {
      currentInputs.suspend_integral = e.target.checked;
      const extraGroup = document.getElementById('group-suspend-extra');
      if (extraGroup) {
        extraGroup.style.display = e.target.checked ? 'flex' : 'none';
      }
      runSimulationAndUpdateUI();
    });
  }

  // Saved runs management
  const btnSaveRun = document.getElementById('btn-save-run');
  if (btnSaveRun) {
    btnSaveRun.addEventListener('click', () => {
      if (!currentSimResult) return;
      if (savedRuns.length >= 4) {
        savedRuns.shift();
      }
      const label = `Run ${savedRuns.length + 1} (${currentInputs.mode}, Kc=${fmt(currentInputs.Kc, 2)})`;
      savedRuns.push({
        label,
        t: currentSimResult.t,
        G: currentSimResult.G
      });
      updateSavedRunsOverlay();
    });
  }

  const btnClearRuns = document.getElementById('btn-clear-runs');
  if (btnClearRuns) {
    btnClearRuns.addEventListener('click', () => {
      savedRuns = [];
      updateSavedRunsOverlay();
    });
  }

  // MPC Toggle
  const btnMpcUnannounced = document.getElementById('btn-mpc-unannounced');
  const btnMpcAnnounced = document.getElementById('btn-mpc-announced');
  if (btnMpcUnannounced && btnMpcAnnounced) {
    btnMpcUnannounced.addEventListener('click', () => {
      mpcMode = 'unannounced';
      btnMpcUnannounced.classList.add('active');
      btnMpcAnnounced.classList.remove('active');
      renderChartP9();
    });
    btnMpcAnnounced.addEventListener('click', () => {
      mpcMode = 'announced';
      btnMpcAnnounced.classList.add('active');
      btnMpcUnannounced.classList.remove('active');
      renderChartP9();
    });
  }
}

function bindSlider(sliderId, labelId, formatFn) {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  if (!slider) return;

  const handleUpdate = () => {
    if (label) {
      label.textContent = formatFn(slider.value);
    }
    runSimulationAndUpdateUI();
  };

  slider.addEventListener('input', handleUpdate);
  slider.addEventListener('change', handleUpdate);
}

function syncControlsFromInputs() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setVal('slider-setpoint', currentInputs.setpoint);
  setText('val-setpoint', `${fmt(currentInputs.setpoint, 0)} mg/dL`);

  setVal('slider-kc', currentInputs.Kc);
  setText('val-kc', fmt(currentInputs.Kc, 3));

  setVal('slider-tau-i', currentInputs.tauI);
  setText('val-tau-i', `${fmt(currentInputs.tauI, 1)} min`);

  setVal('slider-tau-d', currentInputs.tauD);
  setText('val-tau-d', `${fmt(currentInputs.tauD, 1)} min`);

  setVal('slider-filter-n', currentInputs.N);
  setText('val-filter-n', fmt(currentInputs.N, 0));

  setVal('slider-beta', currentInputs.beta);
  setText('val-beta', fmt(currentInputs.beta, 2));

  setVal('slider-sensor-delay', currentInputs.sensor_delay);
  setText('val-sensor-delay', `${fmt(currentInputs.sensor_delay, 0)} min`);

  setVal('slider-sensor-lag', currentInputs.sensor_lag);
  setText('val-sensor-lag', `${fmt(currentInputs.sensor_lag, 1)} min`);

  setVal('slider-sensor-noise', currentInputs.noise_sd);
  setText('val-sensor-noise', `${fmt(currentInputs.noise_sd, 1)} mg/dL`);

  const mult = (currentInputs.meals && currentInputs.meals[0]) ? currentInputs.meals[0][1] : 1.0;
  setVal('slider-meal-mult', mult);
  setText('val-meal-mult', `${fmt(mult, 1)}x`);

  setVal('slider-f-bolus', currentInputs.f_bolus);
  setText('val-f-bolus', fmt(currentInputs.f_bolus, 2));

  setVal('slider-t-pre', currentInputs.t_pre);
  setText('val-t-pre', `${fmt(currentInputs.t_pre, 0)} min`);

  setVal('slider-est-error', currentInputs.est_error);
  setText('val-est-error', `${Math.round(currentInputs.est_error * 100)}%`);

  setVal('slider-suspend-extra', currentInputs.suspend_extra);
  setText('val-suspend-extra', `${fmt(currentInputs.suspend_extra, 0)} min`);

  setVal('select-antiwindup', currentInputs.anti_windup);
  setVal('select-fault', currentInputs.fault || 'none');

  const checkFF = document.getElementById('check-ff');
  if (checkFF) {
    checkFF.checked = Boolean(currentInputs.ff_enabled);
    const ffGroup = document.getElementById('group-ff-sliders');
    if (ffGroup) ffGroup.style.display = checkFF.checked ? 'flex' : 'none';
  }

  const checkSuspend = document.getElementById('check-suspend-int');
  if (checkSuspend) {
    checkSuspend.checked = Boolean(currentInputs.suspend_integral);
    const extraGroup = document.getElementById('group-suspend-extra');
    if (extraGroup) extraGroup.style.display = checkSuspend.checked ? 'flex' : 'none';
  }

  // Set mode button active state
  document.querySelectorAll('.btn-toggle[data-mode]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-mode') === currentInputs.mode);
  });
  updateModeVisibility();

  // Setpoint weight visibility
  const groupBeta = document.getElementById('group-setpoint-weight');
  if (groupBeta) {
    groupBeta.style.display = (Math.abs(currentInputs.setpoint - 81) > 0.1 || (currentInputs.setpoint_steps && currentInputs.setpoint_steps.length > 0)) ? 'flex' : 'none';
  }
}

function updateModeVisibility() {
  const groupTauI = document.getElementById('group-tau-i');
  const groupTauD = document.getElementById('group-tau-d');
  const groupFilterN = document.getElementById('group-filter-n');

  if (currentInputs.mode === 'P') {
    if (groupTauI) groupTauI.style.display = 'none';
    if (groupTauD) groupTauD.style.display = 'none';
    if (groupFilterN) groupFilterN.style.display = 'none';
  } else if (currentInputs.mode === 'PI') {
    if (groupTauI) groupTauI.style.display = 'flex';
    if (groupTauD) groupTauD.style.display = 'none';
    if (groupFilterN) groupFilterN.style.display = 'none';
  } else {
    if (groupTauI) groupTauI.style.display = 'flex';
    if (groupTauD) groupTauD.style.display = 'flex';
    if (groupFilterN) groupFilterN.style.display = 'flex';
  }
}

// -------------------------------------------------------------
// Simulation Pipeline & UI Update
// -------------------------------------------------------------
function runSimulationAndUpdateUI() {
  currentSimResult = simulate(currentInputs);
  const band = { low: DATA.params.band_low.value, high: DATA.params.band_high.value };
  currentMetrics = metrics(currentSimResult, band);

  updateMetricsDisplay();
  updateStabilityDisplay();
  renderSimulatorCharts();
  renderDesignCharts();
}

function updateMetricsDisplay() {
  if (!currentMetrics) return;

  const m = currentMetrics;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('met-peak', `${fmt(m.peak, 1)} mg/dL`);
  setText('met-tpeak', `at ${fmt(m.t_peak, 0)} min`);
  setText('met-nadir', `${fmt(m.nadir, 1)} mg/dL`);
  setText('met-tnadir', `at ${fmt(m.t_nadir, 0)} min`);
  setText('met-pct-band', `${fmt(m.pct_in_band, 1)}%`);
  setText('met-pct-clinical', `${fmt(m.pct_in_70_180, 1)}%`);
  setText('met-pct-hypo', `${fmt(m.pct_below_70, 1)}%`);
  setText('met-iae', fmt(m.IAE, 0));
  setText('met-insulin-total', `${fmt(m.insulin_total, 0)} mU`);
  setText('met-insulin-bolus', `${fmt(m.insulin_ff, 0)} mU`);

  // Safety status badge
  const badge = document.getElementById('badge-safety');
  if (badge) {
    if (m.stayed_in_band) {
      badge.className = 'status-badge status-pass';
      badge.textContent = 'Pass: 100% Within Safety Band';
    } else if (m.nadir < 54.0) {
      badge.className = 'status-badge status-danger';
      badge.textContent = 'Alert: Hypoglycemia (< 54 mg/dL)';
    } else {
      badge.className = 'status-badge status-warn';
      badge.textContent = 'Warning: Exceeded 144 mg/dL';
    }
  }

  // Warning banner
  const warnBanner = document.getElementById('sim-warning-banner');
  const warnText = document.getElementById('sim-warning-text');
  if (warnBanner && warnText) {
    if (currentSimResult.warnings && currentSimResult.warnings.length > 0) {
      warnBanner.style.display = 'block';
      warnText.textContent = currentSimResult.warnings.join(' ');
    } else {
      warnBanner.style.display = 'none';
      warnText.textContent = '';
    }
  }
}

function updateStabilityDisplay() {
  const theta = currentInputs.sensor_delay || 0.0;
  const tauI_val = currentInputs.mode === 'P' ? Infinity : currentInputs.tauI;
  const tauD_val = (currentInputs.mode === 'P' || currentInputs.mode === 'PI') ? 0.0 : currentInputs.tauD;

  const marg = margins({
    Kc: currentInputs.Kc,
    tauI: tauI_val,
    tauD: tauD_val,
    N: currentInputs.N,
    theta
  });

  const marg0 = margins({
    Kc: currentInputs.Kc,
    tauI: tauI_val,
    tauD: tauD_val,
    N: currentInputs.N,
    theta: 0.0
  });

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('val-omega-c', `${fmt(marg.wc, 4)} rad/min`);
  setText('val-pm-deg', `${fmt(marg.PM_deg, 1)}°`);
  setText('val-pm0-deg', `${fmt(marg0.PM_deg, 1)}°`);
  setText('val-max-delay', `${fmt(marg.total_tolerable_delay, 1)} min`);

  // Update SVG text nodes
  setText('svg-diag-kc', `Kc = ${fmt(currentInputs.Kc, 3)}`);
  setText('svg-diag-delay', `e^(-${fmt(theta, 0)}s)`);
}

function updateSavedRunsOverlay() {
  const countEl = document.getElementById('saved-runs-count');
  const cardP8 = document.getElementById('card-p8');
  if (countEl) {
    countEl.textContent = `${savedRuns.length} of 4 saved runs`;
  }
  if (cardP8) {
    cardP8.style.display = savedRuns.length > 0 ? 'block' : 'none';
  }
  if (savedRuns.length > 0) {
    renderChartP8();
  }
}

// -------------------------------------------------------------
// Chart Renderers (Plotly P1 - P11)
// -------------------------------------------------------------
function renderSimulatorCharts() {
  if (!currentSimResult) return;
  renderChartP1();
  renderChartP2();
  renderChartP3();
}

function renderDesignCharts() {
  renderChartP6();
  renderChartP7();
  renderChartP10();
  renderChartP11();
}

function initStaticCharts() {
  renderChartP4();
  renderChartP5();
  renderChartP9();
}

function renderAllPlots() {
  renderSimulatorCharts();
  renderDesignCharts();
  initStaticCharts();
  if (savedRuns.length > 0) {
    renderChartP8();
  }
}

// P1: Glucose Trajectory & Bands
function renderChartP1() {
  const el = document.getElementById('chart-p1');
  if (!el || !currentSimResult) return;

  const theme = getPlotTheme();
  const res = currentSimResult;

  const traceTrue = {
    x: res.t,
    y: res.G,
    mode: 'lines',
    name: 'True Glucose G(t)',
    line: { color: '#2563eb', width: 2.5 }
  };

  const traceMeas = {
    x: res.t,
    y: res.Gm,
    mode: 'lines',
    name: 'Sensor CGM Gm(t)',
    line: { color: '#9333ea', width: 1.5, dash: 'dot' }
  };

  const traceSp = {
    x: res.t,
    y: res.sp || Array(res.t.length).fill(currentInputs.setpoint),
    mode: 'lines',
    name: 'Setpoint',
    line: { color: '#64748b', width: 1.5, dash: 'dash' }
  };

  const shapes = [
    // Clinical target band: 70 - 180 mg/dL (lighter)
    {
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 70,
      y1: 180,
      fillcolor: isDarkTheme ? 'rgba(56, 189, 248, 0.05)' : 'rgba(56, 189, 248, 0.08)',
      line: { width: 0 },
      layer: 'below'
    },
    // Textbook safety band: 54 - 144 mg/dL
    {
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 54,
      y1: 144,
      fillcolor: isDarkTheme ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)',
      line: { width: 1, color: isDarkTheme ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)' },
      layer: 'below'
    }
  ];

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Time t (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Glucose (mg/dL)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor, range: [30, Math.max(200, currentMetrics ? currentMetrics.peak + 20 : 200)] },
    shapes,
    legend: { orientation: 'h', y: 1.15, x: 0 },
    hovermode: 'x unified'
  };

  window.Plotly.react(el, [traceTrue, traceMeas, traceSp], layout, { responsive: true, displayModeBar: false });
}

// P2: Insulin Components
function renderChartP2() {
  const el = document.getElementById('chart-p2');
  if (!el || !currentSimResult) return;

  const theme = getPlotTheme();
  const res = currentSimResult;

  const traceTot = {
    x: res.t,
    y: res.U,
    mode: 'lines',
    name: 'Total Infusion U(t)',
    line: { color: '#0284c7', width: 2 }
  };

  const traceFb = {
    x: res.t,
    y: res.Ufb,
    mode: 'lines',
    name: 'Feedback U_fb',
    line: { color: '#f59e0b', width: 1.5, dash: 'dash' }
  };

  const traceFf = {
    x: res.t,
    y: res.Uff,
    mode: 'lines',
    name: 'Feedforward U_ff',
    line: { color: '#10b981', width: 1.5, dash: 'dot' }
  };

  const traceBasal = {
    x: [res.t[0], res.t[res.t.length - 1]],
    y: [16.668, 16.668],
    mode: 'lines',
    name: 'Basal (16.7 mU/min)',
    line: { color: '#94a3b8', width: 1, dash: 'dash' }
  };

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Time t (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Insulin (mU/min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor, range: [-2, 120] },
    legend: { orientation: 'h', y: 1.15, x: 0 },
    hovermode: 'x unified'
  };

  window.Plotly.react(el, [traceTot, traceFb, traceFf, traceBasal], layout, { responsive: true, displayModeBar: false });
}

// P3: Disturbance Profile
function renderChartP3() {
  const el = document.getElementById('chart-p3');
  if (!el || !currentSimResult) return;

  const theme = getPlotTheme();
  const res = currentSimResult;

  const traceD = {
    x: res.t,
    y: res.D,
    mode: 'lines',
    name: 'Meal Disturbance D(t)',
    line: { color: '#ef4444', width: 2 },
    fill: 'tozeroy',
    fillcolor: isDarkTheme ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'
  };

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Time t (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'D(t) (mg/dL/min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    legend: { orientation: 'h', y: 1.15, x: 0 }
  };

  window.Plotly.react(el, [traceD], layout, { responsive: true, displayModeBar: false });
}

// P8: Overlay of Saved Runs
function renderChartP8() {
  const el = document.getElementById('chart-p8');
  if (!el || savedRuns.length === 0) return;

  const theme = getPlotTheme();
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

  const traces = savedRuns.map((r, idx) => ({
    x: r.t,
    y: r.G,
    mode: 'lines',
    name: r.label,
    line: { color: colors[idx % colors.length], width: 2 }
  }));

  const shapes = [
    {
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 54,
      y1: 144,
      fillcolor: isDarkTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.12)',
      line: { width: 0 },
      layer: 'below'
    }
  ];

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Time t (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Glucose (mg/dL)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    shapes,
    legend: { orientation: 'h', y: 1.15, x: 0 },
    hovermode: 'x unified'
  };

  window.Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
}

// P4: Nonlinear Gain vs dU
function renderChartP4() {
  const el = document.getElementById('chart-p4');
  if (!el) return;

  const theme = getPlotTheme();
  const dUs = [];
  const gains = [];

  for (let du = -16.0; du <= 98.0; du += 1.0) {
    dUs.push(du);
    gains.push(nonlinearGain(du));
  }

  const traceCurve = {
    x: dUs,
    y: gains,
    mode: 'lines',
    name: 'Nonlinear Gain Kp(dU)',
    line: { color: '#0284c7', width: 2.5 }
  };

  const dU_op = (currentInputs.controller === 'none') ? 0.0 : (16.668 - 16.668);
  const traceOp = {
    x: [0.0],
    y: [linearModel().Kp],
    mode: 'markers',
    name: 'Basal Operating Point',
    marker: { color: '#ef4444', size: 10, symbol: 'diamond' }
  };

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Insulin Deviation &Delta;U (mU/min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Steady-State Gain (mg/dL per mU/min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    legend: { orientation: 'h', y: 1.15, x: 0 }
  };

  window.Plotly.react(el, [traceCurve, traceOp], layout, { responsive: true, displayModeBar: false });
}

// P5: Step Response Benchmark
function renderChartP5() {
  const el = document.getElementById('chart-p5');
  if (!el) return;

  const theme = getPlotTheme();
  const times = [];
  const y_nl = [];
  const y_lin = [];
  const y_sopdt = [];
  const y_fopdt = [];

  const lm = linearModel();
  const hr = halfRule();
  const sop = hr.sopdt;
  const fop = hr.fopdt;

  for (let t = 0; t <= 300; t += 1.0) {
    times.push(t);

    // 3rd-order linear analytic response to unit step dU = +1:
    // G(s) = Kp / ((1+tauG s)(1+tauX s)(1+tauI s))
    const pG = 1.0 / lm.tauG;
    const pX = 1.0 / lm.tauX;
    const pI = 1.0 / lm.tauI;
    const c0 = 1.0;
    const c1 = -(pX * pI) / ((pG - pX) * (pG - pI));
    const c2 = -(pG * pI) / ((pX - pG) * (pX - pI));
    const c3 = -(pG * pX) / ((pI - pG) * (pI - pX));
    const y3 = lm.Kp * (c0 + c1 * Math.exp(-pG * t) + c2 * Math.exp(-pX * t) + c3 * Math.exp(-pI * t));
    y_lin.push(y3);

    // SOPDT step: K * (1 - (tau1 e^(-t/tau1) - tau2 e^(-t/tau2))/(tau1 - tau2)) with delay
    const t_eff_sop = t - sop.theta;
    if (t_eff_sop <= 0) {
      y_sopdt.push(0);
    } else {
      const ys = sop.K * (1.0 - (sop.tau1 * Math.exp(-t_eff_sop / sop.tau1) - sop.tau2 * Math.exp(-t_eff_sop / sop.tau2)) / (sop.tau1 - sop.tau2));
      y_sopdt.push(ys);
    }

    // FOPDT step: K * (1 - e^(-(t - theta)/tau))
    const t_eff_fop = t - fop.theta;
    if (t_eff_fop <= 0) {
      y_fopdt.push(0);
    } else {
      const yf = fop.K * (1.0 - Math.exp(-t_eff_fop / fop.tau));
      y_fopdt.push(yf);
    }
  }

  // Nonlinear response via simulate with dU = +1
  const simNl = simulate({
    controller: 'none',
    U_open_loop: 16.668 + 1.0,
    t_end: 300.0,
    meals: []
  });
  for (let t = 0; t <= 300; t += 1.0) {
    const idx = Math.round(t / 0.1);
    y_nl.push(simNl.G[idx] - 81.0);
  }

  const traces = [
    { x: times, y: y_nl, mode: 'lines', name: 'Nonlinear ODE', line: { color: '#0f172a', width: 2.5 } },
    { x: times, y: y_lin, mode: 'lines', name: '3rd-Order Linear', line: { color: '#2563eb', width: 2, dash: 'dash' } },
    { x: times, y: y_sopdt, mode: 'lines', name: 'Half-Rule SOPDT', line: { color: '#10b981', width: 1.5, dash: 'dot' } },
    { x: times, y: y_fopdt, mode: 'lines', name: 'Half-Rule FOPDT', line: { color: '#f59e0b', width: 1.5, dash: 'dashdot' } }
  ];

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Time t (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Glucose Deviation &Delta;G (mg/dL)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    legend: { orientation: 'h', y: 1.15, x: 0 }
  };

  window.Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
}

// P6: Bode Frequency Response
function renderChartP6() {
  const el = document.getElementById('chart-p6');
  if (!el) return;

  const theme = getPlotTheme();
  const freqs = [];
  const mag_dB = [];
  const phase_deg = [];

  const theta = currentInputs.sensor_delay || 0.0;
  const tauI_val = currentInputs.mode === 'P' ? Infinity : currentInputs.tauI;
  const tauD_val = (currentInputs.mode === 'P' || currentInputs.mode === 'PI') ? 0.0 : currentInputs.tauD;

  const marg = margins({
    Kc: currentInputs.Kc,
    tauI: tauI_val,
    tauD: tauD_val,
    N: currentInputs.N,
    theta
  });

  for (let k = 0; k <= 200; k++) {
    const w = 1e-4 * Math.pow(10.0 / 1e-4, k / 200);
    freqs.push(w);

    const res = calcLoopResponse(w, currentInputs.Kc, tauI_val, tauD_val, currentInputs.N, theta);
    mag_dB.push(20.0 * Math.log10(Math.max(1e-6, res.mag)));
    phase_deg.push(res.phase * (180.0 / Math.PI));
  }

  const traceMag = {
    x: freqs,
    y: mag_dB,
    mode: 'lines',
    name: 'Magnitude |L(jw)| (dB)',
    line: { color: '#2563eb', width: 2 },
    xaxis: 'x',
    yaxis: 'y'
  };

  const tracePhase = {
    x: freqs,
    y: phase_deg,
    mode: 'lines',
    name: 'Phase &ang;L(jw) (°)',
    line: { color: '#9333ea', width: 2 },
    xaxis: 'x',
    yaxis: 'y2'
  };

  const layout = {
    ...theme,
    margin: { l: 50, r: 50, t: 20, b: 40 },
    xaxis: { title: 'Frequency &omega; (rad/min)', type: 'log', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Magnitude (dB)', domain: [0.55, 1], gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis2: { title: 'Phase (°)', domain: [0, 0.45], gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    legend: { orientation: 'h', y: 1.15, x: 0 }
  };

  window.Plotly.react(el, [traceMag, tracePhase], layout, { responsive: true, displayModeBar: false });
}

function calcLoopResponse(w, Kc, tauI, tauD, N, theta) {
  const lm = linearModel();
  const mag_Gp = Math.abs(lm.Kp) / (
    Math.sqrt(1.0 + Math.pow(w * lm.tauG, 2)) *
    Math.sqrt(1.0 + Math.pow(w * lm.tauX, 2)) *
    Math.sqrt(1.0 + Math.pow(w * lm.tauI, 2))
  );
  const phase_Gp = -Math.atan(w * lm.tauG) - Math.atan(w * lm.tauX) - Math.atan(w * lm.tauI);

  let re_b = 1.0;
  let im_b = 0.0;
  if (Number.isFinite(tauI) && tauI > 0) {
    im_b -= 1.0 / (w * tauI);
  }
  if (tauD > 0 && N > 0) {
    const wtauD = w * tauD;
    const denom = 1.0 + Math.pow(wtauD / N, 2);
    re_b += (Math.pow(wtauD, 2) / N) / denom;
    im_b += wtauD / denom;
  }

  const mag_b = Math.hypot(re_b, im_b);
  const phase_b = Math.atan2(im_b, re_b);

  const mag_L = Math.abs(Kc) * mag_b * mag_Gp;
  const phase_L = phase_b + phase_Gp - w * theta;

  return { mag: mag_L, phase: phase_L };
}

// P7: Nyquist Plot
function renderChartP7() {
  const el = document.getElementById('chart-p7');
  if (!el) return;

  const theme = getPlotTheme();
  const theta = currentInputs.sensor_delay || 0.0;
  const tauI_val = currentInputs.mode === 'P' ? Infinity : currentInputs.tauI;
  const tauD_val = (currentInputs.mode === 'P' || currentInputs.mode === 'PI') ? 0.0 : currentInputs.tauD;

  const re_L = [];
  const im_L = [];

  for (let k = 0; k <= 300; k++) {
    const w = 1e-4 * Math.pow(10.0 / 1e-4, k / 300);
    const res = calcLoopResponse(w, currentInputs.Kc, tauI_val, tauD_val, currentInputs.N, theta);
    re_L.push(res.mag * Math.cos(res.phase));
    im_L.push(res.mag * Math.sin(res.phase));
  }

  // Unit circle
  const uc_re = [];
  const uc_im = [];
  for (let a = 0; a <= 360; a += 5) {
    const rad = a * Math.PI / 180.0;
    uc_re.push(Math.cos(rad));
    uc_im.push(Math.sin(rad));
  }

  const traceContour = {
    x: re_L,
    y: im_L,
    mode: 'lines',
    name: 'L(jw) Polar Plot',
    line: { color: '#2563eb', width: 2 }
  };

  const traceUnitCircle = {
    x: uc_re,
    y: uc_im,
    mode: 'lines',
    name: 'Unit Circle',
    line: { color: '#94a3b8', width: 1, dash: 'dash' }
  };

  const traceCrit = {
    x: [-1.0],
    y: [0.0],
    mode: 'markers',
    name: 'Critical Point (-1, 0)',
    marker: { color: '#ef4444', size: 10, symbol: 'cross' }
  };

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Real Axis', range: [-2.5, 1.5], gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Imaginary Axis', range: [-2, 1], gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    legend: { orientation: 'h', y: 1.15, x: 0 }
  };

  window.Plotly.react(el, [traceContour, traceUnitCircle, traceCrit], layout, { responsive: true, displayModeBar: false });
}

// P9: Precomputed PID vs MPC
function renderChartP9() {
  const el = document.getElementById('chart-p9');
  if (!el || !DATA.mpcComparison) return;

  const theme = getPlotTheme();
  const mpc = DATA.mpcComparison[mpcMode];
  if (!mpc) return;

  const tracePidG = {
    x: DATA.mpcComparison.t,
    y: mpc.G_PID,
    mode: 'lines',
    name: 'PID Glucose',
    line: { color: '#2563eb', width: 2 }
  };

  const traceMpcG = {
    x: DATA.mpcComparison.t,
    y: mpc.G_MPC,
    mode: 'lines',
    name: 'MPC Glucose',
    line: { color: '#10b981', width: 2 }
  };

  const tracePidU = {
    x: DATA.mpcComparison.t,
    y: mpc.U_PID,
    mode: 'lines',
    name: 'PID Insulin',
    line: { color: '#2563eb', width: 1.5, dash: 'dash' },
    yaxis: 'y2'
  };

  const traceMpcU = {
    x: DATA.mpcComparison.t,
    y: mpc.U_MPC,
    mode: 'lines',
    name: 'MPC Insulin',
    line: { color: '#10b981', width: 1.5, dash: 'dash' },
    yaxis: 'y2'
  };

  const shapes = [
    {
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 54,
      y1: 144,
      fillcolor: isDarkTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.12)',
      line: { width: 0 },
      layer: 'below'
    }
  ];

  const layout = {
    ...theme,
    margin: { l: 50, r: 50, t: 20, b: 40 },
    xaxis: { title: 'Time t (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Glucose (mg/dL)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis2: { title: 'Insulin (mU/min)', overlaying: 'y', side: 'right', gridcolor: 'transparent', range: [0, 120] },
    shapes,
    legend: { orientation: 'h', y: 1.15, x: 0 },
    hovermode: 'x unified'
  };

  window.Plotly.react(el, [tracePidG, traceMpcG, tracePidU, traceMpcU], layout, { responsive: true, displayModeBar: false });
}

// P10: Live Sweep: Glucose Peak & Nadir vs tau_c
function renderChartP10() {
  const el = document.getElementById('chart-p10');
  if (!el) return;

  const theme = getPlotTheme();
  const tau_cs = [];
  const peaks = [];
  const nadirs = [];

  const theta_s = currentInputs.sensor_delay || 10.0;
  for (let tc = 2.0; tc <= 60.0; tc += 3.0) {
    tau_cs.push(tc);
    const tun = imcTuning({ model: 'fit_sopdt', tau_c: tc, theta_sensor: theta_s });
    const sim = simulate({
      ...currentInputs,
      Kc: tun.Kc,
      tauI: tun.tauI,
      tauD: tun.tauD,
      t_end: 360.0,
      meals: [[60.0, 1.0]],
      ff_enabled: false
    });
    const m = metrics(sim, { low: 54, high: 144 });
    peaks.push(m.peak);
    nadirs.push(m.nadir);
  }

  const tracePeak = {
    x: tau_cs,
    y: peaks,
    mode: 'lines',
    name: 'Peak Glucose',
    line: { color: '#ef4444', width: 2 }
  };

  const traceNadir = {
    x: tau_cs,
    y: nadirs,
    mode: 'lines',
    name: 'Nadir Glucose',
    line: { color: '#0284c7', width: 2 }
  };

  const shapes = [
    {
      type: 'line',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 144,
      y1: 144,
      line: { color: '#ef4444', width: 1, dash: 'dash' }
    },
    {
      type: 'line',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 54,
      y1: 54,
      line: { color: '#0284c7', width: 1, dash: 'dash' }
    }
  ];

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'IMC Tuning Filter &tau;c (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Glucose (mg/dL)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    shapes,
    legend: { orientation: 'h', y: 1.15, x: 0 }
  };

  window.Plotly.react(el, [tracePeak, traceNadir], layout, { responsive: true, displayModeBar: false });
}

// P11: Live Sweep: Glucose Peak & Nadir vs Pre-Bolus Time
function renderChartP11() {
  const el = document.getElementById('chart-p11');
  if (!el) return;

  const theme = getPlotTheme();
  const t_pres = [];
  const peaks = [];
  const nadirs = [];

  for (let tp = 0; tp <= 45; tp += 3) {
    t_pres.push(tp);
    const sim = simulate({
      ...currentInputs,
      ff_enabled: true,
      t_pre: tp,
      t_end: 360.0,
      meals: [[60.0, 1.0]]
    });
    const m = metrics(sim, { low: 54, high: 144 });
    peaks.push(m.peak);
    nadirs.push(m.nadir);
  }

  const tracePeak = {
    x: t_pres,
    y: peaks,
    mode: 'lines',
    name: 'Peak Glucose',
    line: { color: '#ef4444', width: 2 }
  };

  const traceNadir = {
    x: t_pres,
    y: nadirs,
    mode: 'lines',
    name: 'Nadir Glucose',
    line: { color: '#0284c7', width: 2 }
  };

  const currentTpre = currentInputs.t_pre || 0.0;
  const traceMarker = {
    x: [currentTpre, currentTpre],
    y: [currentMetrics ? currentMetrics.peak : 81, currentMetrics ? currentMetrics.nadir : 81],
    mode: 'markers',
    name: 'Current t_pre',
    marker: { color: '#10b981', size: 9, symbol: 'circle' }
  };

  const shapes = [
    {
      type: 'rect',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: 54,
      y1: 144,
      fillcolor: isDarkTheme ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.12)',
      line: { width: 0 },
      layer: 'below'
    }
  ];

  const layout = {
    ...theme,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    xaxis: { title: 'Pre-Bolus Lead Time t_pre (min)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    yaxis: { title: 'Glucose (mg/dL)', gridcolor: theme.gridcolor, zerolinecolor: theme.zerolinecolor },
    shapes,
    legend: { orientation: 'h', y: 1.15, x: 0 }
  };

  window.Plotly.react(el, [tracePeak, traceNadir, traceMarker], layout, { responsive: true, displayModeBar: false });
}
