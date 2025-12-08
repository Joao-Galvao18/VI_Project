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

    grid.html("");
    const items = grid.selectAll(".item").data(displayList).enter().append("div")
        .attr("class", d => d.type === 'data' ? "glyph" : "filler").attr("style", d => d.style);
    
    items.filter(d => d.type === 'data').html(d => drawIcon(d.data))
        .on("mousemove", (event, d) => showTooltip(event, d.data)).on("mouseleave", hideTooltip);
}

const pixelPaths = {

    disk: "M4,14 h16 v2 h-16 z M6,12 h12 v2 h-12 z M8,10 h8 v2 h-8 z",
    triangle: "M11,4 h2 v2 h-2 z M10,6 h4 v2 h-4 z M9,8 h6 v2 h-6 z M8,10 h8 v2 h-8 z M7,12 h10 v2 h-10 z M6,14 h12 v2 h-12 z",
    circle: "M9,4 h6 v2 h-6 z M7,6 h2 v2 h-2 z M15,6 h2 v2 h-2 z M6,8 h1 v8 h-1 z M17,8 h1 v8 h-1 z M7,16 h2 v2 h-2 z M15,16 h2 v2 h-2 z M9,18 h6 v2 h-6 z",
    oval: "M6,8 h12 v2 h-12 z M4,10 h16 v4 h-16 z M6,14 h12 v2 h-12 z",
    cylinder: "M10,4 h4 v16 h-4 z M10,4 h4 v2 h-4 z M10,18 h4 v2 h-4 z",
    light: "M11,2 h2 v6 h-2 z M11,16 h2 v6 h-2 z M2,11 h6 v2 h-6 z M16,11 h6 v2 h-6 z M11,11 h2 v2 h-2 z",
    fireball: "M10,8 h6 v6 h-6 z M8,6 h2 v2 h-2 z M14,6 h2 v2 h-2 z M16,8 h2 v2 h-2 z M16,12 h2 v2 h-2 z M14,14 h2 v2 h-2 z M8,14 h2 v2 h-2 z M6,12 h2 v2 h-2 z M6,8 h2 v2 h-2 z",
    formation: "M4,6 h4 v4 h-4 z M16,6 h4 v4 h-4 z M10,14 h4 v4 h-4 z",
    unknown: "M9,6 h6 v2 h-6 z M13,8 h2 v2 h-2 z M13,10 h2 v2 h-2 z M11,12 h4 v2 h-4 z M11,16 h2 v2 h-2 z"
};

function drawIcon(d) {
    const color = countryColors[d.country] || "#f8c200";
    let path = pixelPaths[d.shape] || pixelPaths["unknown"];
    
    return `
    <svg width="100%" height="100%" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" style="shape-rendering: crispEdges;">
        <path d="${path}" fill="${color}" />
    </svg>`;
}