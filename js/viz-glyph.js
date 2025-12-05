import { state, cellSizeMap, countryColors } from './store.js';
import { showTooltip, hideTooltip } from './ui.js';

export function updateGrid() {
    const grid = d3.select("#glyph-grid");
    const container = document.getElementById("view-glyph"); 
    const sortMode = state.filters.sortMode;
    const filtered = state.filtered;

    d3.select("#showing-count").text(filtered.length);
    d3.select("#total-count").text(state.rawData.length);

    const availableWidth = container.getBoundingClientRect().width - 30;
    const cellPixelSize = 40; 
    const gapSize = 6;
    const colTotal = cellPixelSize + gapSize;

    let maxPossibleCols = Math.floor(availableWidth / colTotal);
    let numCols = Math.floor(maxPossibleCols / 6) * 6; 
    if (numCols < 6) numCols = Math.floor(maxPossibleCols / 2) * 2; 
    if (numCols < 1) numCols = 1;

    const finalGridWidth = (numCols * colTotal) - gapSize;
    grid.style("grid-template-columns", `repeat(${numCols}, ${cellPixelSize}px)`)
        .style("width", `${finalGridWidth}px`);

    let gridMap = [];   
    let displayList = []; 
    // Estimation to prevent infinite loops
    const estimatedRows = Math.ceil(filtered.length * 2); 
    const mapSize = numCols * estimatedRows + (numCols * 20); 
    for(let i=0; i<mapSize; i++) gridMap[i] = false;

    let gridCursor = 0;

    function markRegion(index, size) {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                let markIndex = index + (r * numCols) + c;
                gridMap[markIndex] = true;
            }
        }
    }

    function canFit(index, size) {
        const colIndex = index % numCols;
        if (colIndex + size > numCols) return false; 
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                let checkIndex = index + (r * numCols) + c;
                if (gridMap[checkIndex]) return false; 
            }
        }
        return true;
    }

    function forceLineBreak() {
        const colIndex = gridCursor % numCols;
        if (colIndex !== 0) { 
            const slotsToFill = numCols - colIndex;
            for(let i=0; i<slotsToFill; i++) {
                 if (!gridMap[gridCursor]) {
                     const colStart = (gridCursor % numCols) + 1;
                     const rowStart = Math.floor(gridCursor / numCols) + 1;
                     markRegion(gridCursor, 1);
                     displayList.push({ type: 'filler', style: `grid-column: ${colStart} / span 1; grid-row: ${rowStart} / span 1;` });
                 }
                 gridCursor++;
            }
        }
    }

    function processDataList(listToProcess) {
        let cursor = 0;
        while (cursor < listToProcess.length) {
            // Safety extension
            if (gridCursor + (4 * numCols) >= gridMap.length) {
                for(let k=0; k < numCols * 10; k++) gridMap.push(false);
            }
            if (gridMap[gridCursor]) { gridCursor++; continue; }

            const d = listToProcess[cursor];
            let size = cellSizeMap[d.durationCategory] ? cellSizeMap[d.durationCategory].cols : 1;
            if (size > numCols) size = numCols;

            if (canFit(gridCursor, size)) {
                const colStart = (gridCursor % numCols) + 1;
                const rowStart = Math.floor(gridCursor / numCols) + 1;
                markRegion(gridCursor, size);
                displayList.push({
                    type: 'data', data: d,
                    style: `grid-column: ${colStart} / span ${size}; grid-row: ${rowStart} / span ${size};`
                });
                cursor++; 
            } else {
                const colStart = (gridCursor % numCols) + 1;
                const rowStart = Math.floor(gridCursor / numCols) + 1;
                markRegion(gridCursor, 1);
                displayList.push({ type: 'filler', style: `grid-column: ${colStart} / span 1; grid-row: ${rowStart} / span 1;` });
            }
            gridCursor++;
        }
    }

    if (sortMode === "durationHigh" || sortMode === "durationLow") {
        let tier3 = [], tier2 = [], tier1 = [];
        filtered.forEach(d => {
            let cols = cellSizeMap[d.durationCategory] ? cellSizeMap[d.durationCategory].cols : 1;
            if (cols > numCols) cols = numCols;
            if (cols === 3) tier3.push(d); else if (cols === 2) tier2.push(d); else tier1.push(d);
        });
        if (sortMode === "durationHigh") {
            if (tier3.length > 0) { processDataList(tier3); forceLineBreak(); }
            if (tier2.length > 0) { processDataList(tier2); forceLineBreak(); }
            if (tier1.length > 0) { processDataList(tier1); }
        } else {
            if (tier1.length > 0) { processDataList(tier1); forceLineBreak(); }
            if (tier2.length > 0) { processDataList(tier2); forceLineBreak(); }
            if (tier3.length > 0) { processDataList(tier3); }
        }
    } else {
        processDataList(filtered);
    }

    // Render
    grid.html("");
    const items = grid.selectAll(".item").data(displayList).enter().append("div")
        .attr("class", d => d.type === 'data' ? "glyph" : "filler").attr("style", d => d.style);
    
    items.filter(d => d.type === 'data').html(d => drawGlyph(d.data))
        .on("mousemove", (event, d) => showTooltip(event, d.data)).on("mouseleave", hideTooltip);
}

function drawGlyph(d) {
    const color = countryColors[d.country] || "#f8c200";
    return `<svg width="100%" height="100%" viewBox="0 0 48 48" style="image-rendering: pixelated;">${generateShape(d.shape, color)}</svg>`;
}

function generateShape(shape, color) {
    const cx = 24, cy = 24, r = 16;
    switch (shape) {
        case "circle": case "sphere": return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;
        case "disk": return `<rect x="${cx - r}" y="${cy - 8}" width="${2*r}" height="16" fill="${color}" />`;
        case "cylinder": return `<rect x="${cx - 8}" y="${cy - r}" width="16" height="${2*r}" fill="${color}" />`;
        case "triangle": return `<polygon points="${cx},${cy-r} ${cx-r},${cy+r} ${cx+r},${cy+r}" fill="${color}" />`;
        case "light": return `<rect x="${cx - 3}" y="${cy - r}" width="6" height="${2*r}" fill="${color}" /><rect x="${cx - r}" y="${cy - 3}" width="${2*r}" height="6" fill="${color}" />`;
        case "formation": return `<circle cx="${cx - 16}" cy="${cy}" r="6" fill="${color}" /><circle cx="${cx}" cy="${cy}" r="8" fill="${color}" /><circle cx="${cx + 16}" cy="${cy}" r="6" fill="${color}" />`;
        case "fireball": return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" /><circle cx="${cx + 10}" cy="${cy - 10}" r="8" fill="${color}" />`;
        default: return `<text x="18" y="32" font-size="20" fill="${color}">?</text>`;
    }
}