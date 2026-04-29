/**
 * MapViewport — right-click drag to pan, scroll wheel to zoom.
 *
 * Usage:
 *   const group = document.createElementNS(SVG_NS, 'g');
 *   svg.appendChild(group);
 *   const vp = new MapViewport(svg, group, { initialScale: 1.5 });
 *   vp.centerOnSvgPoint(chinaX, chinaY);
 */
class MapViewport {
    constructor(svgEl, contentGroup, opts = {}) {
        this.svg       = svgEl;
        this.group     = contentGroup;
        this.scale     = opts.initialScale  || 1;
        this.tx        = 0;
        this.ty        = 0;
        this.minScale  = opts.minScale  || 0.4;
        this.maxScale  = opts.maxScale  || 12;
        this.zoomSpeed = opts.zoomSpeed || 0.0015;

        this._panning  = false;
        this._lastX    = 0;
        this._lastY    = 0;
        this._moved    = false;

        this._onMouseDown  = this._onMouseDown.bind(this);
        this._onMouseMove  = this._onMouseMove.bind(this);
        this._onMouseUp    = this._onMouseUp.bind(this);
        this._onWheel      = this._onWheel.bind(this);
        this._onContext     = e => e.preventDefault();

        this.svg.addEventListener('mousedown',   this._onMouseDown);
        window.addEventListener('mousemove',     this._onMouseMove);
        window.addEventListener('mouseup',       this._onMouseUp);
        this.svg.addEventListener('wheel',       this._onWheel, { passive: false });
        this.svg.addEventListener('contextmenu', this._onContext);

        this._applyTransform();
    }

    /* ---- public ---- */

    centerOnSvgPoint(sx, sy) {
        const r = this.svg.getBoundingClientRect();
        this.tx = r.width  / 2 - sx * this.scale;
        this.ty = r.height / 2 - sy * this.scale;
        this._applyTransform();
    }

    setScale(s) {
        this.scale = this._clampScale(s);
        this._applyTransform();
    }

    centerAndZoom(sx, sy, s) {
        this.scale = this._clampScale(s);
        this.centerOnSvgPoint(sx, sy);
    }

    get isPanning() { return this._panning && this._moved; }

    /* ---- internals ---- */

    _clampScale(s) {
        return Math.max(this.minScale, Math.min(this.maxScale, s));
    }

    _applyTransform() {
        this.group.setAttribute('transform',
            `translate(${this.tx.toFixed(2)},${this.ty.toFixed(2)}) scale(${this.scale.toFixed(4)})`);
    }

    _onMouseDown(e) {
        if (e.button !== 2) return;
        e.preventDefault();
        this._panning = true;
        this._moved   = false;
        this._lastX   = e.clientX;
        this._lastY   = e.clientY;
        this.svg.classList.add('panning');
    }

    _onMouseMove(e) {
        if (!this._panning) return;
        const dx = e.clientX - this._lastX;
        const dy = e.clientY - this._lastY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this._moved = true;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        this.tx += dx;
        this.ty += dy;
        this._applyTransform();
    }

    _onMouseUp(e) {
        if (e.button !== 2) return;
        this._panning = false;
        this.svg.classList.remove('panning');
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this.svg.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const factor = 1 - e.deltaY * this.zoomSpeed;
        const newScale = this._clampScale(this.scale * factor);
        const ratio = newScale / this.scale;

        this.tx = mx - ratio * (mx - this.tx);
        this.ty = my - ratio * (my - this.ty);
        this.scale = newScale;
        this._applyTransform();
    }
}
