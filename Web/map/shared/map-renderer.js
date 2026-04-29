/**
 * GeoJSON -> SVG Map Renderer
 * Handles projection, path generation, and interactive feature rendering.
 */
const MapRenderer = (() => {
    const DEG2RAD = Math.PI / 180;

    // Mercator projection
    function mercatorX(lon, width) {
        return (lon + 180) * (width / 360);
    }

    function mercatorY(lat, width, height) {
        const latClamp = Math.max(-85, Math.min(85, lat));
        const latRad = latClamp * DEG2RAD;
        const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
        return height / 2 - (width / (2 * Math.PI)) * mercN;
    }

    function projectPoint(lon, lat, cfg) {
        const x = mercatorX(lon, cfg.mapWidth);
        const y = mercatorY(lat, cfg.mapWidth, cfg.mapHeight);
        return [(x - cfg.offsetX) * cfg.scale + cfg.padX,
                (y - cfg.offsetY) * cfg.scale + cfg.padY];
    }

    function ringToPath(ring, cfg) {
        if (!ring || ring.length === 0) return '';
        const pts = ring.map(c => projectPoint(c[0], c[1], cfg));
        return 'M' + pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z';
    }

    function geometryToPath(geometry, cfg) {
        if (!geometry) return '';
        const { type, coordinates } = geometry;
        let d = '';

        if (type === 'Polygon') {
            for (const ring of coordinates) {
                d += ringToPath(ring, cfg);
            }
        } else if (type === 'MultiPolygon') {
            for (const polygon of coordinates) {
                for (const ring of polygon) {
                    d += ringToPath(ring, cfg);
                }
            }
        }
        return d;
    }

    function computeBounds(features) {
        let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;

        function updateBounds(coords) {
            for (const c of coords) {
                if (Array.isArray(c[0])) {
                    updateBounds(c);
                } else {
                    if (c[0] < minLon) minLon = c[0];
                    if (c[0] > maxLon) maxLon = c[0];
                    if (c[1] < minLat) minLat = c[1];
                    if (c[1] > maxLat) maxLat = c[1];
                }
            }
        }

        for (const f of features) {
            if (f.geometry && f.geometry.coordinates) {
                updateBounds(f.geometry.coordinates);
            }
        }
        return { minLon, maxLon, minLat, maxLat };
    }

    /**
     * Render a GeoJSON FeatureCollection as SVG paths.
     *
     * @param {SVGElement} svgEl   - The root <svg> (used for size calculation)
     * @param {object}     geojson - GeoJSON FeatureCollection
     * @param {object}     options
     *   - container: SVG element to append paths to (defaults to svgEl)
     *   - getClass(feature): returns CSS class string
     *   - getId(feature): returns element id
     *   - groupBy(feature): optional, group id for merging features
     *   - bounds: {minLon, maxLon, minLat, maxLat} to override auto-computed
     *   - padding: pixels of padding (default 20)
     */
    function render(svgEl, geojson, options = {}) {
        const container = options.container || svgEl;
        const svgW = svgEl.clientWidth || svgEl.viewBox.baseVal.width || 1200;
        const svgH = svgEl.clientHeight || svgEl.viewBox.baseVal.height || 600;
        const padding = options.padding ?? 20;

        const features = geojson.features || [];
        const bounds = options.bounds || computeBounds(features);

        const baseW = 2000;
        const baseH = 1200;

        const x0 = mercatorX(bounds.minLon, baseW);
        const x1 = mercatorX(bounds.maxLon, baseW);
        const y0 = mercatorY(bounds.maxLat, baseW, baseH);
        const y1 = mercatorY(bounds.minLat, baseW, baseH);

        const geoW = x1 - x0;
        const geoH = y1 - y0;
        const scaleX = (svgW - padding * 2) / geoW;
        const scaleY = (svgH - padding * 2) / geoH;
        const scale = Math.min(scaleX, scaleY);

        const renderedW = geoW * scale;
        const renderedH = geoH * scale;

        const cfg = {
            mapWidth: baseW,
            mapHeight: baseH,
            offsetX: x0,
            offsetY: y0,
            scale: scale,
            padX: (svgW - renderedW) / 2,
            padY: (svgH - renderedH) / 2
        };

        const groupMap = {};

        for (const feature of features) {
            const groupId = options.groupBy ? options.groupBy(feature) : null;
            const d = geometryToPath(feature.geometry, cfg);
            if (!d) continue;

            if (groupId && groupMap[groupId]) {
                const existing = groupMap[groupId];
                existing.pathData += d;
                existing.el.setAttribute('d', existing.pathData);
                if (!existing.features) existing.features = [existing.origFeature];
                existing.features.push(feature);
                continue;
            }

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('vector-effect', 'non-scaling-stroke');

            const id = options.getId ? options.getId(feature) : (feature.id || '');
            if (id) path.setAttribute('id', id);

            const cls = options.getClass ? options.getClass(feature) : 'land';
            path.setAttribute('class', cls);

            path.dataset.featureId = id;
            if (feature.properties) {
                path.dataset.name = feature.properties.name || '';
                if (feature.properties.adcode) {
                    path.dataset.adcode = feature.properties.adcode;
                }
            }

            container.appendChild(path);

            if (groupId) {
                groupMap[groupId] = { el: path, pathData: d, origFeature: feature };
            }
        }

        return cfg;
    }

    function walkCoordinates(coords, cb) {
        if (!coords || coords.length === 0) return;
        if (typeof coords[0] === 'number') {
            cb(coords[0], coords[1]);
        } else {
            for (const c of coords) walkCoordinates(c, cb);
        }
    }

    /**
     * Axis-aligned bbox of a feature in projected SVG space (for centroid + label sizing).
     */
    function featureProjectedBBox(feature, cfg) {
        if (!feature || !feature.geometry || !feature.geometry.coordinates) return null;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        walkCoordinates(feature.geometry.coordinates, (lon, lat) => {
            const p = projectPoint(lon, lat, cfg);
            minX = Math.min(minX, p[0]);
            maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]);
            maxY = Math.max(maxY, p[1]);
        });
        if (!isFinite(minX)) return null;
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /** Shoelace area in projected plane (for comparing polygon fragments). */
    function ringProjectedArea(ring, cfg) {
        if (!ring || ring.length < 3) return 0;
        let a = 0;
        const n = ring.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const pi = projectPoint(ring[i][0], ring[i][1], cfg);
            const pj = projectPoint(ring[j][0], ring[j][1], cfg);
            a += pi[0] * pj[1] - pj[0] * pi[1];
        }
        return Math.abs(a * 0.5);
    }

    function ringProjectedBounds(ring, cfg) {
        if (!ring || ring.length === 0) return null;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const c of ring) {
            const p = projectPoint(c[0], c[1], cfg);
            minX = Math.min(minX, p[0]);
            maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]);
            maxY = Math.max(maxY, p[1]);
        }
        if (!isFinite(minX)) return null;
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * BBox of the single largest exterior ring (MultiPolygon 时取面积最大的外环)，
     * 避免海外省、阿拉斯加、北极群岛把标签拽到海上或极地。
     */
    function featurePrimaryPartProjectedBBox(feature, cfg) {
        const g = feature && feature.geometry;
        if (!g || !g.coordinates) return null;

        if (g.type === 'Polygon') {
            const ext = g.coordinates[0];
            return ext ? ringProjectedBounds(ext, cfg) : null;
        }

        if (g.type === 'MultiPolygon') {
            let bestBounds = null;
            let bestArea = 0;
            for (const poly of g.coordinates) {
                const ext = poly && poly[0];
                if (!ext) continue;
                const ar = ringProjectedArea(ext, cfg);
                if (ar > bestArea) {
                    bestArea = ar;
                    bestBounds = ringProjectedBounds(ext, cfg);
                }
            }
            return bestBounds;
        }

        return featureProjectedBBox(feature, cfg);
    }

    /**
     * Append a <g class="map-label-layer"> with one <text> per feature (centre of projected bbox).
     * Labels sit in the same coordinate system as paths and scale with MapViewport transforms.
     *
     * @param {SVGElement} container - Usually #mapContent
     * @param {object[]}   features   - GeoJSON features
     * @param {object}     cfg         - Return value of render()
     * @param {object}     options
     *   - getLabel(feature): string (required)
     *   - shouldInclude(feature): optional filter
     *   - sizeRatio: font ≈ min(w,h) * ratio (default 0.09)
     *   - minFontSize, maxFontSize: clamp in SVG user units（min 不会超过区域可容纳上限，避免小国字比版图大）
     *   - maxCoverageOfMinSide: 字号不超过 min(宽,高) 的比例（默认 0.34），防止盖住小国家
     *   - cjkCharWidthFactor: 估算中文标签宽度 ≈ fs * n * factor，用于按包围盒宽度再收紧字号
     *   - useGeomMeanForWidthCap: 为 true 时用 √(宽×高) 辅助估算可排字宽度（狭长国更不易被压没）
     *   - skipIfBelowFont: 低于该字号则跳过（默认 0.38）；过小无意义且省 DOM
     *   - usePrimaryPartForLabelBox: 用最大外环估算包围盒与字号（默认 true），减轻多部分国家偏移
     *   - getAnchorLonLat(feature): 可选 [lon,lat] 固定锚点（用于加拿大等仍偏北的国家）
     *   - lengthAdjust: optional function (text, baseSize) => number
     */
    function appendLabelLayer(container, features, cfg, options = {}) {
        const getLabel = options.getLabel;
        if (typeof getLabel !== 'function') return null;

        const shouldInclude = options.shouldInclude || (() => true);
        const sizeRatio = options.sizeRatio ?? 0.09;
        const minFontSize = options.minFontSize;
        const maxFontSize = options.maxFontSize ?? 18;
        const maxCoverageOfMinSide = options.maxCoverageOfMinSide ?? 0.34;
        const cjkCharWidthFactor = options.cjkCharWidthFactor ?? 0.88;
        const maxLabelWidthRatio = options.maxLabelWidthRatio ?? 0.88;
        const useGeomMeanForWidthCap = options.useGeomMeanForWidthCap !== false;
        const skipIfBelowFont = options.skipIfBelowFont ?? 0.38;
        const usePrimaryPartForLabelBox = options.usePrimaryPartForLabelBox !== false;
        const getAnchorLonLat = options.getAnchorLonLat;
        const lengthAdjust = options.lengthAdjust;
        const className = options.className || 'map-label';

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'map-label-layer');
        g.setAttribute('pointer-events', 'none');

        for (const feature of features) {
            if (!shouldInclude(feature)) continue;
            const raw = getLabel(feature);
            const textStr = raw == null ? '' : String(raw).trim();
            if (!textStr) continue;

            const bb = usePrimaryPartForLabelBox
                ? (featurePrimaryPartProjectedBBox(feature, cfg) || featureProjectedBBox(feature, cfg))
                : featureProjectedBBox(feature, cfg);
            if (!bb || bb.width < 1 || bb.height < 1) continue;

            let cx = (bb.minX + bb.maxX) / 2;
            let cy = (bb.minY + bb.maxY) / 2;
            if (typeof getAnchorLonLat === 'function') {
                const ll = getAnchorLonLat(feature);
                if (ll && typeof ll[0] === 'number' && typeof ll[1] === 'number') {
                    const p = projectPoint(ll[0], ll[1], cfg);
                    cx = p[0];
                    cy = p[1];
                }
            }

            const dim = Math.min(bb.width, bb.height);

            const capBySide = dim * maxCoverageOfMinSide;
            const approxLen = Math.max(textStr.length, 1);
            const capByWidthFlat = (bb.width * maxLabelWidthRatio) / (approxLen * cjkCharWidthFactor);
            let capByWidth = capByWidthFlat;
            if (useGeomMeanForWidthCap) {
                const geom = Math.sqrt(Math.max(bb.width * bb.height, 1e-6));
                const capByGeom = (geom * maxLabelWidthRatio * 1.05) / (approxLen * cjkCharWidthFactor);
                capByWidth = Math.max(capByWidthFlat, capByGeom);
            }

            let fs = dim * sizeRatio;
            fs = Math.min(fs, maxFontSize);
            if (lengthAdjust) fs = lengthAdjust(textStr, fs);

            fs = Math.min(fs, capBySide, capByWidth);

            if (minFontSize != null && minFontSize > 0) {
                const floor = Math.min(minFontSize, capBySide * 0.98, capByWidth * 0.98);
                fs = Math.max(fs, floor);
            }

            if (skipIfBelowFont > 0 && fs < skipIfBelowFont) continue;

            const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textEl.setAttribute('x', cx.toFixed(2));
            textEl.setAttribute('y', cy.toFixed(2));
            textEl.setAttribute('text-anchor', 'middle');
            textEl.setAttribute('dominant-baseline', 'middle');
            textEl.setAttribute('class', className);
            textEl.setAttribute('font-size', fs.toFixed(2));
            textEl.textContent = textStr;
            g.appendChild(textEl);
        }

        container.appendChild(g);
        return g;
    }

    return {
        render,
        computeBounds,
        projectPoint,
        geometryToPath,
        featureProjectedBBox,
        featurePrimaryPartProjectedBBox,
        appendLabelLayer
    };
})();
