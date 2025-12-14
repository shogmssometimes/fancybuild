// interactive social matrix
import CSGraph from './graph.js';
console.log('csmatrix: starting boot');
let svg = document.getElementById('matrix-svg');
console.log('csmatrix: svg element', !!svg, svg ? `viewbox:${svg.getAttribute('viewBox')}` : 'no-svg');
if (!svg) {
	try {
		const wrap = document.getElementById('matrix-canvas-wrap') || document.body;
		const created = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		created.setAttribute('id', 'matrix-svg');
		created.setAttribute('width', '100%');
		created.setAttribute('viewBox', '0 0 1000 1000');
		created.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		created.style.display = 'block';
		wrap.appendChild(created);
		svg = created;
		console.log('csmatrix: created fallback svg element');
	} catch (err) { console.warn('csmatrix: could not create fallback svg', err); }
}
let graph;
try {
	graph = new CSGraph(svg);
	console.log('csmatrix: graph created');
	if (typeof window !== 'undefined') { window.graph = graph; window.svg = svg; }
} catch (err) {
	console.error('csmatrix: graph creation failed', err);
}
// graph.globalMeters will be set after globalMeters is declared (below)
// persist changes to localStorage
// global meters (not node dependent)
const DEFAULT_NODE_COLOR = '#f0764b';
const sanitizeHexColor = (value) => {
	if (!value && value !== 0) return null;
	const trimmed = `${value}`.trim();
	if (!trimmed) return null;
	const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
	if (/^[0-9a-fA-F]{6}$/.test(hex)) { return `#${hex.toLowerCase()}`; }
	if (/^[0-9a-fA-F]{3}$/.test(hex)) { return `#${hex.split('').map((ch)=>`${ch}${ch}`).join('').toLowerCase()}`; }
	return null;
};
const getColorOrDefault = (value) => sanitizeHexColor(value) || DEFAULT_NODE_COLOR;
const addAlpha = (hex, alpha) => {
	const norm = sanitizeHexColor(hex);
	if (!norm) return null;
	// alpha as two hex chars (e.g., 'cc' for ~80%)
	return `${norm}${alpha}`;
};
const applySliderColors = (card, color) => {
	const strong = addAlpha(color, 'cc') || 'rgba(240,118,75,0.8)';
	const weak = addAlpha(color, '59') || 'rgba(240,118,75,0.35)';
	card.style.setProperty('--slider-color-strong', strong);
	card.style.setProperty('--slider-color-weak', weak);
};

let globalMeters = { collapse: 0, influence: 0, record: 0 };
// ensure graph has the global meters for initial rendering
function persistGraph() {
	try {
		const json = (graph && typeof graph.toJSON === 'function') ? graph.toJSON() : { nodes: [], edges: [] };
		json.meta = { globalMeters };
		localStorage.setItem('csmatrix.graph', JSON.stringify(json));
	} catch (err) { /* ignore */ }
}
// whenever graph changes, persist and update the node list
graph.onChange = () => { console.log('graph.onChange: nodes', graph.nodes.length); persistGraph(); updateNodeList(); };
// sync wrapper height to the rendered svg height to avoid vertical letterbox padding
function getDynamicGraphHeight() {
	const viewport = typeof window !== 'undefined' ? window.innerHeight : 720;
	const header = document.querySelector('header');
	const headerH = header ? header.offsetHeight : 0;
	let reserved = headerH + 40;
	if (typeof document !== 'undefined' && document.body.classList.contains('nodes-open')) {
		const nodeSection = document.getElementById('node-list-section');
		const drawer = nodeSection && nodeSection.offsetHeight ? nodeSection.offsetHeight + 16 : Math.min(420, viewport * 0.4);
		reserved += drawer;
	}
	return Math.max(320, viewport - reserved);
}
function syncCanvasHeight() {
	try {
		const svgEl = document.getElementById('matrix-svg');
		const wrap = document.getElementById('matrix-canvas-wrap');
		if (!svgEl || !wrap) return;
		const targetHeight = getDynamicGraphHeight();
		svgEl.style.height = `${targetHeight}px`;
		wrap.style.height = `${targetHeight}px`;
		wrap.style.minHeight = `${targetHeight}px`;
	} catch (e) { /* ignore */ }
}
if (svg) svg.addEventListener('graph:rendered', () => { syncCanvasHeight(); });
console.log('csmatrix: listeners wired (approx)');
if (!graph) {
	console.error('csmatrix: graph failed to initialize; skipping interactive wiring');
	const errEl = document.getElementById('app-error'); if (errEl) { errEl.classList.remove('hidden'); }
} else {

// HUD click handler removed (meters are changed from Controls only)
function getCssVar(varName, fallback) {
	try {
		const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
		return v || fallback;
	} catch (err) { return fallback; }
}
function hslToHex(hsl) {
	try {
		// parse hsl(h,s%,l%)
		const m = hsl.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/i);
		if (!m) return getCssVar('--text', '#e8eef3');
		const h = Number(m[1]) / 360; const s = Number(m[2]) / 100; const l = Number(m[3]) / 100;
		function hue2rgb(p, q, t) {
			if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p;
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
		const r = Math.round(hue2rgb(p, q, h + 1/3) * 255); const g = Math.round(hue2rgb(p, q, h) * 255); const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
		const toHex = (x) => ('0' + x.toString(16)).slice(-2);
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	} catch (err) { return getCssVar('--text', '#e8eef3'); }
}
// wire controls
document.getElementById('btn-add-node').addEventListener('click', () => {
	// add a node at center by default
	const gx = 0, gy = 0;
	const defaultColor = getColorOrDefault(graph._nextColor ? graph._nextColor() : getCssVar('--accent-influence', '#4caf50'));
	const node = graph.addNode({ name: 'New Node', gx, gy, color: defaultColor });
	graph.selectNode(node);
	// also allow click-to-place: set mode briefly
	graph.setMode('addNode'); svg.classList.add('adding-node');
	setTimeout(() => { graph.setMode(null); svg.classList.remove('adding-node'); }, 3000);
});
document.getElementById('btn-delete').addEventListener('click', () => {
	if (graph.selected.node) {
		console.log('Delete Selected clicked for', graph.selected.node.id);
		graph.removeNode(graph.selected.node.id);
		try { persistGraph(); } catch (e) {}
		updateNodeList();
	}
});
document.getElementById('btn-export').addEventListener('click', () => {
	const json = graph.toJSON(); json.meta = { globalMeters };
	const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `csmatrix-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
document.getElementById('import-file').addEventListener('change', (ev) => {
	const f = ev.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => {
		try {
			const json = JSON.parse(reader.result);
			graph.fromJSON(json);
			if (json.meta && json.meta.globalMeters) { globalMeters = json.meta.globalMeters; updateGlobalMetersUI(); updateControlMeterBars(); }
			persistGraph();
		} catch (err) { alert('Invalid JSON file'); }
	};
	reader.readAsText(f);
});
document.getElementById('btn-reset').addEventListener('click', () => { localStorage.removeItem('csmatrix.graph'); loadSample(); });

// Node edit panel wiring
// Node panel overlay removed; per-card panels are embedded in the node list.
graph.svg.addEventListener('graph:select', (ev) => { requestAnimationFrame(() => { updateEdgePanel(); updateNodeList(); }); });
	// per-card save handlers are created inline when building node cards.

// live input handlers for sliders and color
// per-card live input handlers are created when panels are built.

// Global meters buttons (wired regardless of graph presence)
function updateGlobalMetersUI() {
	const elCollapse = document.getElementById('global-meter-collapse-value'); if (elCollapse) elCollapse.textContent = globalMeters.collapse || 0;
	const elInfluence = document.getElementById('global-meter-influence-value'); if (elInfluence) elInfluence.textContent = globalMeters.influence || 0;
	const elRecord = document.getElementById('global-meter-record-value'); if (elRecord) elRecord.textContent = globalMeters.record || 0;
}
const changeGlobalMeter = (name, delta) => {
	globalMeters[name] = Math.max(0, Math.min(6, (globalMeters[name] || 0) + delta));
	updateGlobalMetersUI();
	persistGraph();
	updateControlMeterBars();
};
const stopNodeCardPropagation = (element) => {
	if (!element) return;
	['mousedown','mouseup','touchstart','touchend','click','dblclick','focus','keydown'].forEach(evt => {
		element.addEventListener(evt, (ev) => ev.stopPropagation());
	});
};
const bindBtn = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
bindBtn('global-plus-collapse', ()=> changeGlobalMeter('collapse', +1));
bindBtn('global-minus-collapse', ()=> changeGlobalMeter('collapse', -1));
bindBtn('global-plus-influence', ()=> changeGlobalMeter('influence', +1));
bindBtn('global-minus-influence', ()=> changeGlobalMeter('influence', -1));
bindBtn('global-plus-record', ()=> changeGlobalMeter('record', +1));
bindBtn('global-minus-record', ()=> changeGlobalMeter('record', -1));
// Update small control meter bars when values change
function updateControlMeterBars() {
	const renderBars = (id, value, colorClass) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.innerHTML = '';
		for (let i=0;i<6;i++) {
			const unit = document.createElement('span'); unit.className = `unit ${i < value ? 'active ' + colorClass : ''}`; el.appendChild(unit);
		}
	};
	renderBars('ctrl-meter-collapse', globalMeters.collapse || 0, 'collapse');
	renderBars('ctrl-meter-influence', globalMeters.influence || 0, 'influence');
	renderBars('ctrl-meter-record', globalMeters.record || 0, 'record');
}
// wire toggle for showing controls on mobile
const btnToggleControls = document.getElementById('btn-toggle-controls');
function syncControlsToggleState(isOpen) {
	if (!btnToggleControls) return;
	const open = typeof isOpen === 'boolean' ? isOpen : document.body.classList.contains('controls-open');
	btnToggleControls.textContent = open ? 'Hide Controls' : 'Show Controls';
	btnToggleControls.setAttribute('aria-expanded', open ? 'true' : 'false');
}
if (btnToggleControls) {
	btnToggleControls.addEventListener('click', () => {
		const isOpen = document.body.classList.toggle('controls-open');
		syncControlsToggleState(isOpen);
		// Trigger a graph re-render to ensure the canvas resizes and nodes update
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {}
		// Update visibility helper for small screens
		updateControlsVisibility();
	});
}
// Maximize graph removed (feature removed per request)
// Maximize graph removed
// hide controls from within the controls panel
const btnHideControls = document.getElementById('btn-hide-controls');
if (btnHideControls) {
	btnHideControls.addEventListener('click', () => {
		document.body.classList.remove('controls-open');
		syncControlsToggleState(false);
		updateControlsVisibility();
	});
}
// When hide controls clicked, ensure the graph updates
if (btnHideControls) {
	btnHideControls.addEventListener('click', () => { try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {} });
}
const btnToggleNodes = document.getElementById('btn-toggle-nodes');
const btnHideNodes = document.getElementById('btn-hide-nodes');
function syncNodeToggleState() {
	if (!btnToggleNodes) return;
	const open = document.body.classList.contains('nodes-open');
	btnToggleNodes.textContent = open ? 'Hide Nodes' : 'Show Nodes';
	btnToggleNodes.setAttribute('aria-expanded', open ? 'true' : 'false');
}
if (btnToggleNodes) {
	btnToggleNodes.addEventListener('click', () => {
		const open = document.body.classList.toggle('nodes-open');
		syncNodeToggleState();
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch (e) {}
		if (open) {
			const nodeSection = document.getElementById('node-list-section');
			if (nodeSection && typeof nodeSection.scrollIntoView === 'function') {
				nodeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
		try { syncCanvasHeight(); } catch (e) {}
	});
}
if (btnHideNodes) {
	btnHideNodes.addEventListener('click', () => {
		document.body.classList.remove('nodes-open');
		syncNodeToggleState();
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch (e) {}
		try { syncCanvasHeight(); } catch (e) {}
	});
}
syncControlsToggleState();
syncNodeToggleState();

// HUD toggle button: hide/show header meters and controls
const btnToggleHud = document.getElementById('btn-toggle-hud');
if (btnToggleHud) {
	btnToggleHud.setAttribute('aria-pressed', document.body.classList.contains('hud-hidden') ? 'true' : 'false');
	btnToggleHud.addEventListener('click', () => {
		const hidden = document.body.classList.toggle('hud-hidden');
		// set aria-pressed state and update aria-label for screen readers
		btnToggleHud.setAttribute('aria-pressed', hidden ? 'true' : 'false');
		btnToggleHud.setAttribute('aria-label', hidden ? 'Show HUD' : 'Hide HUD');
		// also ensure Controls are hidden when HUD is hidden
		if (hidden) {
			document.body.classList.remove('controls-open');
			document.body.classList.remove('nodes-open');
			try { syncControlsToggleState(false); } catch (e) {}
			syncNodeToggleState();
		}
		// update axis pills for screen readers
		document.querySelectorAll('.axis-pill').forEach(el => { el.setAttribute('aria-hidden', hidden ? 'true' : 'false'); });
		// ensure graph redraw for layout changes
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {}
	});
}
	// ensure graph redraw on viewport resizes so canvas fills available space
	window.addEventListener('resize', () => { try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {} });
// Note: previously there was an in-graph HUD button; it's removed from markup to avoid duplication
// Toggle pills and header by double-tap on the canvas (mobile friendly gesture)
document.getElementById('matrix-canvas-wrap').addEventListener('dblclick', () => {
	const btn = document.getElementById('btn-toggle-hud'); if (btn) btn.click();
});
// Force auto-fit now that the manual toggle has been removed
try {
	if (graph && typeof graph.setAutoMax === 'function') graph.setAutoMax(true);
	document.body.classList.add('graph-auto-max');
} catch (e) { /* ignore */ }
// Helper to sync UI scale classes for posture modes
const applyScaleClass = (mode) => {
	const value = mode || 'normal';
	document.body.classList.remove('ui-scale-compact','ui-scale-normal','ui-scale-spacious');
	document.body.classList.add(value === 'compact' ? 'ui-scale-compact' : (value === 'spacious' ? 'ui-scale-spacious' : 'ui-scale-normal'));
};
// posture toggle: compact UI vs normal (persisted)
const btnPosture = document.getElementById('btn-posture');
function loadPosture() {
	try {
		const p = localStorage.getItem('csmatrix.posture');
		applyScaleClass(p || 'normal');
		if (btnPosture) btnPosture.setAttribute('aria-pressed', document.body.classList.contains('ui-scale-compact') ? 'true' : 'false');
	} catch (e) {}
}
if (btnPosture) {
	btnPosture.addEventListener('click', () => {
		const compact = !document.body.classList.contains('ui-scale-compact');
		const next = compact ? 'compact' : 'normal';
		applyScaleClass(next);
		localStorage.setItem('csmatrix.posture', next);
		btnPosture.setAttribute('aria-pressed', compact ? 'true' : 'false');
	});
}
loadPosture();
// Controls visibility helper: overlay panel only shows when controls-open and HUD is visible
function updateControlsVisibility() {
	const controlsEl = document.getElementById('controls');
	if (!controlsEl) return;
	if (document.body.classList.contains('hud-hidden')) {
		controlsEl.style.setProperty('display', 'none', 'important');
		return;
	}
	if (document.body.classList.contains('controls-open')) {
		controlsEl.style.setProperty('display', 'block', 'important');
	} else {
		controlsEl.style.setProperty('display', 'none', 'important');
	}
}
// Expose helper globally for automated tests & script toggles
try { window.updateControlsVisibility = updateControlsVisibility; } catch(e) {}
window.addEventListener('resize', updateControlsVisibility);
updateControlsVisibility();
// also call syncCanvasHeight on initial load so wrapper matches svg size
try { syncCanvasHeight(); } catch(e) {}
// old overlay cancel button removed — per-card cancel buttons now available

// Edge UI removed - edges are not used for simplified social matrix
function updateEdgePanel() { return; }

// Node list rendering
function updateNodeList() {
	const list = document.getElementById('node-list'); if (!list) return;
	console.log('updateNodeList called, nodes:', graph.nodes.map(n => n.id));
	list.innerHTML = '';
	if (!graph.nodes || graph.nodes.length === 0) {
		const empt = document.createElement('div'); empt.textContent = 'No nodes yet — Add a node with the Add Node button'; empt.style.color='var(--muted)'; list.appendChild(empt);
		return;
	}
	graph.nodes.forEach(n => {
		const card = document.createElement('div'); card.className = 'node-card'; card.tabIndex = 0; card.setAttribute('role','button');
		const header = document.createElement('div'); header.className = 'node-card-head';
		const colorValue = getColorOrDefault(n.color);
		n.color = colorValue;
		applySliderColors(card, colorValue);
		const sw = document.createElement('div'); sw.className = 'node-swatch'; sw.style.backgroundColor = colorValue; header.appendChild(sw);
		const meta = document.createElement('div'); meta.className = 'node-meta';
		const title = document.createElement('div'); title.textContent = n.name || '(no name)'; title.className = 'node-name'; meta.appendChild(title);
		const coords = document.createElement('div'); coords.textContent = `x: ${n.gx} y: ${n.gy}`; coords.className = 'node-coords'; meta.appendChild(coords);
		header.appendChild(meta);
		const del = document.createElement('button'); del.className = 'delete-node'; del.textContent = 'Delete'; del.setAttribute('aria-label', `Delete ${n.name || 'node'}`);
		del.addEventListener('click', (ev) => { ev.stopPropagation(); console.log('delete button clicked for', n.id); graph.removeNode(n.id); try { persistGraph(); } catch (e) {} updateNodeList(); });
		header.appendChild(del);
		card.appendChild(header);
		// Removed stat line under header

		// inline node panel (embedded into the card)
		const panel = document.createElement('div'); panel.className = 'node-panel-inline panel';
		// Name field
		const nameLabel = document.createElement('label'); nameLabel.textContent = 'Name: '; const nameInput = document.createElement('input'); nameInput.value = n.name || ''; nameLabel.appendChild(nameInput); panel.appendChild(nameLabel);
		stopNodeCardPropagation(nameInput);
		// X slider
		const xLabel = document.createElement('label'); xLabel.textContent = 'Trust / Distrust (X): '; const xInput = document.createElement('input'); xInput.type = 'range'; xInput.min = -6; xInput.max = 6; xInput.step = 1; xInput.value = typeof n.gx === 'number' ? n.gx : 0; const xSpan = document.createElement('span'); xSpan.textContent = xInput.value; xLabel.appendChild(xInput); xLabel.appendChild(xSpan); panel.appendChild(xLabel);
		stopNodeCardPropagation(xInput);
		// Y slider
		const yLabel = document.createElement('label'); yLabel.textContent = 'Carte Blanche / Surveillance (Y): '; const yInput = document.createElement('input'); yInput.type = 'range'; yInput.min = -6; yInput.max = 6; yInput.step = 1; yInput.value = typeof n.gy === 'number' ? n.gy : 0; const ySpan = document.createElement('span'); ySpan.textContent = yInput.value; yLabel.appendChild(yInput); yLabel.appendChild(ySpan); panel.appendChild(yLabel);
		stopNodeCardPropagation(yInput);
		// Color
		const colorLabel = document.createElement('label'); colorLabel.textContent = 'Color Hex: ';
		const colorInput = document.createElement('input');
		colorInput.type = 'text';
		colorInput.inputMode = 'text';
		colorInput.autocomplete = 'off';
		colorInput.spellcheck = false;
		colorInput.maxLength = 7;
		colorInput.placeholder = DEFAULT_NODE_COLOR;
		colorInput.value = colorValue;
		colorLabel.appendChild(colorInput);
		panel.appendChild(colorLabel);
		stopNodeCardPropagation(colorInput);
		// Quick palette
		const palette = document.createElement('div');
		palette.className = 'color-palette';
		const paletteColors = ['#f0764b','#7b78ff','#56ffc9','#ffd760','#ff6fa5','#6fc3ff','#9df06b','#f0b26b','#c8a5ff','#ff9455','#55ffd1','#ff4d4d','#4dd0ff'];
		const applyColor = (val) => {
			const normalizedColor = getColorOrDefault(val);
			n.color = normalizedColor;
			colorInput.value = normalizedColor;
			sw.style.backgroundColor = normalizedColor;
			applySliderColors(card, normalizedColor);
			graph.render();
		};
		paletteColors.forEach((hex) => {
			const swatch = document.createElement('button');
			swatch.type = 'button';
			swatch.className = 'color-swatch';
			swatch.style.backgroundColor = hex;
			swatch.setAttribute('aria-label', `Set color ${hex}`);
			swatch.addEventListener('click', (ev) => { ev.stopPropagation(); applyColor(hex); });
			palette.appendChild(swatch);
		});
		panel.appendChild(palette);
		// Actions
		const actions = document.createElement('div'); actions.className = 'panel-actions'; const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel'; actions.appendChild(saveBtn); actions.appendChild(cancelBtn); panel.appendChild(actions);
		// Save & cancel logic
		saveBtn.addEventListener('click', (ev) => {
			ev.stopPropagation();
			n.name = nameInput.value;
			title.textContent = n.name || '(no name)';
			const gx = parseInt(xInput.value,10);
			const gy = parseInt(yInput.value,10);
			if (Number.isFinite(gx)) n.gx = Math.max(-6, Math.min(6, gx));
			if (Number.isFinite(gy)) n.gy = Math.max(-6, Math.min(6, gy));
			const normalizedColor = getColorOrDefault(colorInput.value);
			n.color = normalizedColor;
			colorInput.value = normalizedColor;
			sw.style.backgroundColor = normalizedColor;
			applySliderColors(card, normalizedColor);
			coords.textContent = `x: ${n.gx} y: ${n.gy}`;
			try { persistGraph(); } catch(e) {}
			graph.render();
			updateNodeList();
		});
		cancelBtn.addEventListener('click', (ev) => {
			ev.stopPropagation();
			nameInput.value = n.name || '';
			xInput.value = typeof n.gx === 'number' ? n.gx : 0;
			xSpan.textContent = xInput.value;
			yInput.value = typeof n.gy === 'number' ? n.gy : 0;
			ySpan.textContent = yInput.value;
			const normalizedColor = getColorOrDefault(n.color);
			colorInput.value = normalizedColor;
			sw.style.backgroundColor = normalizedColor;
			applySliderColors(card, normalizedColor);
		});
		// live input handlers
		xInput.addEventListener('input', (ev) => { xSpan.textContent = ev.target.value; const gx = parseInt(ev.target.value,10); if (!Number.isNaN(gx)) { n.gx = Math.max(-6, Math.min(6, gx)); coords.textContent = `x: ${n.gx} y: ${n.gy}`; graph.render(); } });
		yInput.addEventListener('input', (ev) => { ySpan.textContent = ev.target.value; const gy = parseInt(ev.target.value,10); if (!Number.isNaN(gy)) { n.gy = Math.max(-6, Math.min(6, gy)); coords.textContent = `x: ${n.gx} y: ${n.gy}`; graph.render(); } });
		colorInput.addEventListener('change', (ev) => {
			const normalizedColor = getColorOrDefault(ev.target.value);
			ev.target.value = normalizedColor;
			n.color = normalizedColor;
			sw.style.backgroundColor = normalizedColor;
			applySliderColors(card, normalizedColor);
			graph.render();
		});
		// select on click - toggle open/close panel on repeated click
		const toggleSelect = () => {
			if (graph.selected.node && graph.selected.node.id === n.id) {
				graph.clearSelection();
			} else {
				graph.selectNode(n);
			}
		};
		card.addEventListener('click', toggleSelect);
		card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSelect(); } });
		// show/hide panel depending on selection
		if (graph.selected.node && graph.selected.node.id === n.id) { card.classList.add('selected'); panel.style.display = 'block'; } else { panel.style.display = 'none'; }
		card.appendChild(panel);
		list.appendChild(card);
	});
}

// load a simple sample
function loadSample() {
	const saved = localStorage.getItem('csmatrix.graph');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			if (!parsed || !parsed.nodes || parsed.nodes.length === 0) {
				throw new Error('Saved graph is empty or invalid');
			}
			graph.fromJSON(parsed);
			if (parsed.meta && parsed.meta.globalMeters) { globalMeters = parsed.meta.globalMeters; updateControlMeterBars(); }
			updateGlobalMetersUI();
			return;
		} catch (err) { /* continue to sample */ }
	}
	const sample = { nodes: [ { id: 'n1', name: 'Organizer', gx: -1, gy: 2 }, { id: 'n2', name: 'Ally', gx: 1, gy: 2 }, { id: 'n3', name: 'Neutral', gx: 0, gy: 0 } ], edges: [], meta: { globalMeters: { collapse: 0, influence: 2, record: 1 } } };
	try {
		graph.fromJSON(sample);
	} catch (err) { console.error('csmatrix: graph.fromJSON failed', err); }
	if (sample.meta && sample.meta.globalMeters) { globalMeters = sample.meta.globalMeters; updateControlMeterBars(); }
	updateGlobalMetersUI();
	// Ensure the node organizer and list are shown on initial load
	try { updateNodeList(); } catch(e) { /* ignore */ }
}
try { loadSample(); } catch (err) { console.error('csmatrix: loadSample failed', err); }
	updateControlMeterBars();
	// ensure axis pills have default aria state
	document.querySelectorAll('.axis-pill').forEach(el => el.setAttribute('aria-hidden', 'false'));
}
/* meters always visible; toggle removed */
