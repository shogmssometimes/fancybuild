// Minimal graph renderer for the social matrix
class CSGraph {
  constructor(svg) {
    this.svg = svg;
    this.nodes = [];
    this.selected = { node: null };
    this.gridMin = -6; this.gridMax = 6; this.gridSteps = this.gridMax - this.gridMin;
    this.viewBox = { x: 0, y: 0, w: 1000, h: 1000 };
    this.basePad = { left: 140, right: 140, top: 140, bottom: 140 };
    this.pad = Object.assign({}, this.basePad);
    try { this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`); } catch (e) {}
    this.scale = 1;
    // whether the graph will auto-fit/maximize to the canvas area
    this.autoMax = true;
    this.lockScale = false; // when true, prevent the scale from reducing below lockedScale value
    this._lockedScale = null;
    // Recompute scale when viewport size changes
    if (typeof window !== 'undefined') window.addEventListener('resize', () => { try { this.render(); } catch(e) {} });
    this._initEvents();
  }
  _initEvents() {
    this.svg.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t && t.dataset && t.dataset.nodeId) {
        const n = this.nodes.find(x => x.id === t.dataset.nodeId);
        if (n) this.selectNode(n);
      } else {
        this.clearSelection();
      }
    });
  }
  addNode(n) {
    n.id = n.id || `n${Date.now()}`;
    n.gx = typeof n.gx === 'number' ? n.gx : 0;
    n.gy = typeof n.gy === 'number' ? n.gy : 0;
    n.color = n.color || '#8bc34a';
    this.nodes.push(n);
    console.log('graph.addNode', n.id, 'color:', n.color);
    this.render();
    return n;
  }
  removeNode(id) {
    console.log('graph.removeNode called', id, 'before', this.nodes.length);
    this.nodes = this.nodes.filter(x => x.id !== id);
    console.log('graph.removeNode after', this.nodes.length);
    if (this.selected.node && this.selected.node.id === id) {
      this.selected.node = null;
      try { this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node: null } })); } catch (e) { /* ignore */ }
    }
    this.render();
    // Ensure listeners are notified immediately after removal
    if (this.onChange) try { this.onChange(); } catch (e) { /* ignore */ }
  }
  clearSelection() { this.selected.node = null; this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node: null } })); this.render(); }
  selectNode(node) { this.selected.node = node; this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node } })); this.render(); }
  setAutoMax(v) { this.autoMax = !!v; try { this.render(); } catch (e) {} }
  setLockScale(v) { this.lockScale = !!v; if (this.lockScale) this._lockedScale = this.scale; else this._lockedScale = null; try { this.render(); } catch(e) {} }
  gridToPixel(gx, gy) {
    const steps = this.gridSteps;
    const w = this.viewBox.w - this.pad.left - this.pad.right;
    const h = this.viewBox.h - this.pad.top - this.pad.bottom;
    const x = this.pad.left + ((gx - this.gridMin) / steps) * w;
    const y = this.pad.top + ((this.gridMax - gy) / steps) * h;
    return { x, y };
  }
  render() {
    // compute current scale of the SVG container to scale nodes and labels
    try {
      const rect = this.svg.getBoundingClientRect();
      const ratioX = rect.width / this.viewBox.w;
      const ratioY = rect.height / this.viewBox.h;
      // For 'meet' semantics (full graph visible), pick the smaller ratio so the entire viewbox fits inside the container
      this.scale = Math.min(ratioX, ratioY);
      if (this.lockScale && Number.isFinite(this._lockedScale) && this._lockedScale > this.scale) {
        // we want to avoid reducing the scale while lockScale is active
        this.scale = this._lockedScale;
      }
      if (!Number.isFinite(this.scale) || this.scale <= 0) this.scale = 1;
    } catch (e) { this.scale = 1; }
    // Reduce padding proportionally to scale so grid occupies more of the frame on large viewports
    try {
      // If autoMax is enabled, use a much smaller pad to let the grid fill the viewport;
      // otherwise compute pad scaled proportionally as before
        if (this.autoMax) {
          this.pad.left = 0; this.pad.right = 0; this.pad.top = 0; this.pad.bottom = 0;
        } else {
          // If autoMax is disabled, compute proportional pad based on the scale and clamp to reasonable bounds
          const padScale = Math.max(1, this.scale);
          const clamp = (v, minv, maxv) => Math.max(minv, Math.min(maxv, v));
          const padMin = 48;
          this.pad.left = clamp(Math.round(this.basePad.left / padScale), padMin, this.basePad.left);
          this.pad.right = clamp(Math.round(this.basePad.right / padScale), padMin, this.basePad.right);
          this.pad.top = clamp(Math.round(this.basePad.top / padScale), padMin, this.basePad.top);
          this.pad.bottom = clamp(Math.round(this.basePad.bottom / padScale), padMin, this.basePad.bottom);
        }
        this._initGrid();
      this._initGrid();
    } catch (e) { /* ignore */ }
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    // grid lines and edge ticks
    const w = this.viewBox.w - this.pad.left - this.pad.right;
    const h = this.viewBox.h - this.pad.top - this.pad.bottom;
    const cellW = w / this.gridSteps; const cellH = h / this.gridSteps;
    // center axes pixel coordinates for placing tick labels along 0 axes
    const center = this.gridToPixel(0, 0); const centerX = center.x; const centerY = center.y;
    for (let i = this.gridMin; i <= this.gridMax; i++) {
      const x = this.pad.left + (i - this.gridMin) * cellW;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      line.setAttribute('y1', this.pad.top); line.setAttribute('y2', this.viewBox.h - this.pad.bottom);
      line.setAttribute('stroke', 'var(--border)'); this.svg.appendChild(line);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const labelY = Math.max(this.pad.top + 12, Math.min(centerY + 26, this.viewBox.h - this.pad.bottom - 12));
      t.setAttribute('x', x); t.setAttribute('y', labelY.toString()); t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', 'var(--muted)'); t.textContent = i.toString(); try { t.classList.add('tick'); } catch(e) {} this.svg.appendChild(t);
    }
    // Notify client code when the graph changes (persist and update UI)
    if (this.onChange) try { this.onChange(); } catch (err) { /* ignore */ }
    for (let i = this.gridMin; i <= this.gridMax; i++) {
      const y = this.pad.top + (i - this.gridMin) * cellH;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('x1', this.pad.left); line.setAttribute('x2', this.viewBox.w - this.pad.right);
      line.setAttribute('stroke', 'var(--border)'); this.svg.appendChild(line);
      // Hide the Y-axis label at the grid center (i === 0) to avoid duplicated '0' at intersection.
      if (i === 0) { const spacer = document.createElementNS('http://www.w3.org/2000/svg','text'); spacer.setAttribute('x', (centerX - 12).toString()); spacer.setAttribute('y', y); spacer.setAttribute('font-size','0'); spacer.textContent = ''; this.svg.appendChild(spacer); }
      else { const tY = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tY.setAttribute('x', (centerX - 12).toString()); const labelY2 = Math.max(this.pad.top + 10, Math.min(y, this.viewBox.h - this.pad.bottom - 10)); tY.setAttribute('y', labelY2); tY.setAttribute('text-anchor', 'end'); tY.setAttribute('dominant-baseline', 'middle'); tY.setAttribute('fill', 'var(--muted)'); tY.textContent = (-i).toString(); try { tY.classList.add('tick'); } catch(e) {} this.svg.appendChild(tY); }
    }
    // axis title labels removed; axis pills provide those labels outside the SVG
    // nodes
    this.nodes.forEach(n => {
      const p = this.gridToPixel(n.gx, n.gy);
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('transform', `translate(${p.x},${p.y})`);
      g.setAttribute('data-node-id', n.id);
      // Add a stable class so CSS hover rules can target this group's contents
      g.classList.add('node');
      const accentColor = (typeof window !== 'undefined' && window.getComputedStyle) ? (getComputedStyle(document.documentElement).getPropertyValue('--accent-influence').trim() || '#4caf50') : '#4caf50';
      const fillColor = (n.color && n.color.startsWith('#')) ? n.color : (n.color && n.color.startsWith('hsl') ? n.color : (n.color ? n.color : accentColor));
      const defaultRadius = 28;
      const maxRadius = 72;
      // If autoMax is enabled, allow labels and circles to use a mild visual boost
      const extra = this.autoMax ? 1.25 : 1;
      const scaled = Math.round(defaultRadius * Math.max(1, this.scale * extra));
      const r = Math.min(maxRadius, scaled);
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle'); circle.setAttribute('r', r.toString()); circle.setAttribute('cx', 0); circle.setAttribute('cy', 0); circle.setAttribute('fill', fillColor); circle.setAttribute('fill-opacity', '1'); circle.setAttribute('stroke', 'rgba(255,255,255,0.06)'); circle.setAttribute('stroke-width', '2'); circle.setAttribute('data-node-id', n.id); g.appendChild(circle);
      if (this.selected.node && this.selected.node.id === n.id) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg','circle'); ring.setAttribute('r', (r + 6).toString()); ring.setAttribute('cx', 0); ring.setAttribute('cy', 0); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'var(--accent-collapse)'); ring.setAttribute('stroke-width', '4'); g.appendChild(ring);
        // Ensure selected group gets a selected CSS class for label visibility
        try { g.classList.add('selected'); } catch(e) { /* ignore */ }
      }
      // Node label: visible on hover/select, larger font-size by default and grow on hover/tap
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x', '0');
      text.setAttribute('y', (r + 14).toString());
      text.setAttribute('text-anchor','middle');
      text.setAttribute('fill','var(--text)');
      text.textContent = n.name || 'Node';
      // Default text sizing: double the original size for readability
      const defaultTextSize = Math.round(40 * Math.max(1, this.scale * extra)).toString();
      const hoverTextSize = Math.round(72 * Math.max(1, this.scale * extra)).toString();
      const activeTextSize = Math.round(100 * Math.max(1, this.scale * extra)).toString();
      text.setAttribute('font-size', defaultTextSize);
      try { text.classList.add('node-label'); } catch(e) {}
      // Keep the attribute for backwards compatibility (tests / styles) but prefer CSS class-based display
      text.setAttribute('opacity', (this.selected.node && this.selected.node.id === n.id) ? '1' : '0');
      // Pointer events: show label on hover and grow it; on touch (pointerdown) enlarge more briefly
      let _hoverTimeout = null;
      const defaultSize = defaultTextSize;
      const hoverSize = hoverTextSize;
      const activeSize = activeTextSize;
      g.addEventListener('pointerenter', () => { if (_hoverTimeout) { clearTimeout(_hoverTimeout); _hoverTimeout = null; } text.setAttribute('opacity','1'); text.setAttribute('font-size', hoverSize); try { g.classList.add('hover'); } catch(e) {} });
      g.addEventListener('pointerleave', () => { if (_hoverTimeout) { clearTimeout(_hoverTimeout); _hoverTimeout = null; } text.setAttribute('font-size', defaultSize); text.setAttribute('opacity', (this.selected.node && this.selected.node.id === n.id) ? '1' : '0'); try { g.classList.remove('hover'); } catch(e) {} });
      g.addEventListener('pointerdown', () => { if (_hoverTimeout) clearTimeout(_hoverTimeout); text.setAttribute('opacity','1'); text.setAttribute('font-size', activeSize); try { g.classList.add('active'); } catch(e) {} // restore after short delay if not selected
        _hoverTimeout = setTimeout(() => { _hoverTimeout = null; if (!(this.selected.node && this.selected.node.id === n.id)) { text.setAttribute('font-size', defaultSize); text.setAttribute('opacity','0'); } else { text.setAttribute('font-size', hoverSize); text.setAttribute('opacity','1'); } }, 1200); });
      g.addEventListener('pointerup', () => { if (_hoverTimeout) clearTimeout(_hoverTimeout); _hoverTimeout = null; if (!(this.selected.node && this.selected.node.id === n.id)) { text.setAttribute('opacity', '0'); text.setAttribute('font-size', defaultSize); } else { text.setAttribute('font-size', hoverSize); text.setAttribute('opacity','1'); } try { g.classList.remove('active'); } catch(e) {} });
      g.appendChild(text);
      console.log('render node', n.id, 'color:', n.color, 'px', p.x, p.y);
      this.svg.appendChild(g);
    });
    // notify listeners a render completed, include scale and pad for layout sync
    try { this.svg.dispatchEvent(new CustomEvent('graph:rendered', { detail: { scale: this.scale, pad: this.pad } })); } catch (e) {}
  }
  fromJSON(j) {
    this.nodes = (j.nodes || []).map(n => {
      let gx = (typeof n.gx === 'number') ? n.gx : (typeof n.x === 'number' ? this.pixelToGrid(n.x, n.y).gx : 0);
      let gy = (typeof n.gy === 'number') ? n.gy : (typeof n.y === 'number' ? this.pixelToGrid(n.x, n.y).gy : 0);
      return { id: n.id || `n${Date.now()}`, name: n.name, gx, gy, color: n.color };
    });
    this.render();
  }
}
export default CSGraph;
