// ----------------------------------------------------
// UFO DATA MATRIX — FULL JAVASCRIPT ENGINE
// (Mosaic grid + filters + sorting + fillers + tooltip)
// ----------------------------------------------------

let rawData = [];
let filtered = [];

// Sets for filters
let activeCountries = new Set();
let activeShapes = new Set();

// Slider values
let yearMin = 1949;
let yearMax = 2024;
let durMin = 0;
let durMax = 120;

// Colors by country
const countryColors = {
    us: "#f8c200",
    gb: "#00eaff",
    ca: "#00ff7f",
    au: "#ff00ff",
    de: "#00ff00",
    unknown: "#999999"
};

// Duration category → cell size (in grid spans)
const cellSizeMap = {
    short:  { cols: 1, rows: 1 },
    medium: { cols: 2, rows: 2 },
    long:   { cols: 3, rows: 3 }, // RESTORED: Now we have 3 sizes!
    unknown:{ cols: 1, rows: 1 }
};
// ----------------------------------------------------
// LOAD DATA
// ----------------------------------------------------
d3.json("data/ufo_sample_500_clean.json").then(data => {

    // Parse datetime safely
    data.forEach(d => {
        d.datetimeParsed = d.datetimeISO ? new Date(d.datetimeISO) : null;
        if (isNaN(d.datetimeParsed)) d.datetimeParsed = null;
    });

    rawData = data;
    filtered = data;

    initFilters();
    initSliders();
    setupSortingListener();
    applyFilters(); // initial pass (applies sorting + grid)
});

// ----------------------------------------------------
// FILTER TAGS
// ----------------------------------------------------
function initFilters() {
    const countryList = ["us", "gb", "ca", "au"];
    const shapeList = [
        "circle", "disk", "light", "fireball",
        "sphere", "triangle", "formation", "cylinder", "unknown"
    ];

    // Countries
    const cDiv = d3.select("#filter-countries");
    countryList.forEach(c => {
        cDiv.append("div")
            .attr("class", "tag")
            .text(c.toUpperCase())
            .on("click", function () {
                if (activeCountries.has(c)) activeCountries.delete(c);
                else activeCountries.add(c);

                d3.select(this).classed("active", activeCountries.has(c));
                applyFilters();
            });
    });

    // Shapes
    const sDiv = d3.select("#filter-shapes");
    shapeList.forEach(s => {
        sDiv.append("div")
            .attr("class", "tag")
            .text(s)
            .on("click", function () {
                if (activeShapes.has(s)) activeShapes.delete(s);
                else activeShapes.add(s);

                d3.select(this).classed("active", activeShapes.has(s));
                applyFilters();
            });
    });
}

// ----------------------------------------------------
// SLIDER INITIALIZATION
// ----------------------------------------------------
function initSliders() {
    const yearMinSlider = document.getElementById("year-min");
    const yearMaxSlider = document.getElementById("year-max");
    const durMinSlider = document.getElementById("duration-min");
    const durMaxSlider = document.getElementById("duration-max");

    // YEAR MIN
    yearMinSlider.oninput = () => {
        yearMin = Math.min(parseInt(yearMinSlider.value), parseInt(yearMaxSlider.value) - 1);
        yearMinSlider.value = yearMin;

        document.getElementById("year-label-min").textContent = yearMin;
        document.getElementById("year-val-min").textContent = yearMin;

        applyFilters();
    };

    // YEAR MAX
    yearMaxSlider.oninput = () => {
        yearMax = Math.max(parseInt(yearMinSlider.value) + 1, parseInt(yearMaxSlider.value));
        yearMaxSlider.value = yearMax;

        document.getElementById("year-label-max").textContent = yearMax;
        document.getElementById("year-val-max").textContent = yearMax;

        applyFilters();
    };

    // DURATION MIN
    durMinSlider.oninput = () => {
        durMin = Math.min(parseInt(durMinSlider.value), parseInt(durMaxSlider.value) - 1);
        durMinSlider.value = durMin;

        document.getElementById("dur-label-min").textContent = durMin;
        document.getElementById("dur-val-min").textContent = durMin + "M";

        applyFilters();
    };

    // DURATION MAX
    durMaxSlider.oninput = () => {
        durMax = Math.max(parseInt(durMinSlider.value) + 1, parseInt(durMaxSlider.value));
        durMaxSlider.value = durMax;

        document.getElementById("dur-label-max").textContent = durMax;
        document.getElementById("dur-val-max").textContent = durMax + "M";

        applyFilters();
    };
}

// ----------------------------------------------------
// SORTING SYSTEM
// ----------------------------------------------------
function setupSortingListener() {
    const select = document.getElementById("sort-select");
    if (!select) return;

    select.addEventListener("change", () => {
        applySorting();
        updateGrid();
    });
}

function applySorting() {
    const select = document.getElementById("sort-select");
    if (!select) return;

    const mode = select.value;

    filtered.sort((a, b) => {
        const aTime = a.datetimeParsed ? a.datetimeParsed.getTime() : 0;
        const bTime = b.datetimeParsed ? b.datetimeParsed.getTime() : 0;

        switch(mode) {

            case "newest":
                return bTime - aTime;

            case "oldest":
                return aTime - bTime;

            case "durationHigh":
                return (b.durationSeconds || 0) - (a.durationSeconds || 0);

            case "durationLow":
                return (a.durationSeconds || 0) - (b.durationSeconds || 0);

            case "countryAZ":
                return (a.country || "").localeCompare(b.country || "");

            case "cityAZ":
                return (a.city || "").localeCompare(b.city || "");

            case "shapeAZ":
                return (a.shape || "").localeCompare(b.shape || "");

            default:
                return 0;
        }
    });
}

// ----------------------------------------------------
// FILTERING LOGIC
// ----------------------------------------------------
function applyFilters() {
    filtered = rawData.filter(d => {

        const countryOK = activeCountries.size === 0 || activeCountries.has(d.country);
        const shapeOK = activeShapes.size === 0 || activeShapes.has(d.shape);

        // YEAR FILTER (don't drop unknown years)
        const year = d.datetimeParsed ? d.datetimeParsed.getFullYear() : null;
        const yearOK = (year === null) || (year >= yearMin && year <= yearMax);

        const minutes = d.durationSeconds ? d.durationSeconds / 60 : 0;
        const durationOK = minutes >= durMin && minutes <= durMax;

        return countryOK && shapeOK && yearOK && durationOK;
    });

    applySorting();
    updateGrid();
}

// ----------------------------------------------------
// GLYPH DRAWER
// ----------------------------------------------------
function drawGlyph(d) {
    const color = countryColors[d.country] || "#f8c200";
    return `
    <svg width="100%" height="100%" viewBox="0 0 48 48" style="image-rendering: pixelated;">
        ${generateShape(d.shape, color)}
    </svg>`;
}

function generateShape(shape, color) {
    const cx = 24, cy = 24, r = 16;

    switch (shape) {
        case "circle":
        case "sphere":
            return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`;

        case "disk":
            return `<rect x="${cx - r}" y="${cy - 8}" width="${2*r}" height="16" fill="${color}" />`;

        case "cylinder":
            return `<rect x="${cx - 8}" y="${cy - r}" width="16" height="${2*r}" fill="${color}" />`;

        case "triangle":
            return `
                <polygon points="${cx},${cy-r} ${cx-r},${cy+r} ${cx+r},${cy+r}"
                fill="${color}" />
            `;

        case "light":
            return `
                <rect x="${cx - 3}" y="${cy - r}" width="6" height="${2*r}" fill="${color}" />
                <rect x="${cx - r}" y="${cy - 3}" width="${2*r}" height="6" fill="${color}" />
            `;

        case "formation":
            return `
                <circle cx="${cx - 16}" cy="${cy}" r="6" fill="${color}" />
                <circle cx="${cx}" cy="${cy}" r="8" fill="${color}" />
                <circle cx="${cx + 16}" cy="${cy}" r="6" fill="${color}" />
            `;

        case "fireball":
            return `
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />
                <circle cx="${cx + 10}" cy="${cy - 10}" r="8" fill="${color}" />
            `;

        default:
            return `<text x="18" y="32" font-size="20" fill="${color}">?</text>`;
    }
}

// ----------------------------------------------------
// SAFE TOOLTIP (NO OVERFLOW)
// ----------------------------------------------------
function safe(v, fallback = "Unknown") {
    return (v === undefined || v === null || v === "" ? fallback : v);
}

function showTooltip(event, d) {
    const t = d3.select("#tooltip");

    const html = `
ID: ${safe(d.id)}
Date: ${safe(d.datetime)}
Location: ${safe(d.city)}, ${safe(d.state)}, ${safe(d.country, "").toString().toUpperCase()}
Shape: ${safe(d.shape)}
Duration: ${safe(d.durationSeconds)}s (${safe(d.durationCategory)})
Coords: ${safe(d.latitude)}, ${safe(d.longitude)}
--------------------------------------------------
${safe(d.comments, "(No comments)")}
    `;

    t.html(html);

    const tooltipWidth = 260;
    const padding = 20;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let x = event.clientX + padding;
    let y = event.clientY + padding;

    const rect = t.node().getBoundingClientRect();
    const h = rect.height || 180;

    if (x + tooltipWidth > viewportW) {
        x = event.clientX - tooltipWidth - padding;
    }

    if (y + h > viewportH) {
        y = event.clientY - h - padding;
    }

    t.style("left", x + "px")
     .style("top", y + "px")
     .style("opacity", 1);
}

function hideTooltip() {
    d3.select("#tooltip").style("opacity", 0);
}

// ----------------------------------------------------
// GRID UPDATE (HYBRID: TIERS FOR DURATION, MIXED FOR OTHERS)
// ----------------------------------------------------
function updateGrid() {
    const grid = d3.select("#glyph-grid");
    const container = grid.node().parentNode;
    const sortMode = document.getElementById("sort-select").value; // Get current sort

    // 1. Update Counts
    d3.select("#showing-count").text(filtered.length);
    d3.select("#total-count").text(rawData.length);

    // 2. Calculate Grid Dimensions (Force Multiples of 6)
    const availableWidth = container.getBoundingClientRect().width - 40; 
    const cellPixelSize = 40; 
    const gapSize = 6;
    const colTotal = cellPixelSize + gapSize;

    let maxPossibleCols = Math.floor(availableWidth / colTotal);
    let numCols = Math.floor(maxPossibleCols / 6) * 6; 
    if (numCols < 6) numCols = Math.floor(maxPossibleCols / 2) * 2; 
    if (numCols < 1) numCols = 1;

    // Force CSS width
    const finalGridWidth = (numCols * colTotal) - gapSize;
    grid.style("grid-template-columns", `repeat(${numCols}, ${cellPixelSize}px)`)
        .style("width", `${finalGridWidth}px`);

    // 3. COMMON PACKING HELPERS
    let gridMap = [];   
    let displayList = []; 
    
    // Initialize Map
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
                     displayList.push({
                        type: 'filler',
                        style: `grid-column: ${colStart} / span 1; grid-row: ${rowStart} / span 1;`
                     });
                 }
                 gridCursor++;
            }
        }
    }

    // GENERIC PLACEMENT FUNCTION (Used by both modes)
    function processDataList(listToProcess) {
        let cursor = 0;
        while (cursor < listToProcess.length) {
            if (gridCursor + (4 * numCols) >= gridMap.length) {
                for(let k=0; k < numCols * 10; k++) gridMap.push(false);
            }

            if (gridMap[gridCursor]) {
                gridCursor++;
                continue;
            }

            const d = listToProcess[cursor];
            
            // Determine size
            let size = cellSizeMap[d.durationCategory] ? cellSizeMap[d.durationCategory].cols : 1;
            if (size > numCols) size = numCols;

            if (canFit(gridCursor, size)) {
                // PLACE DATA
                const colStart = (gridCursor % numCols) + 1;
                const rowStart = Math.floor(gridCursor / numCols) + 1;
                markRegion(gridCursor, size);
                displayList.push({
                    type: 'data',
                    data: d,
                    style: `grid-column: ${colStart} / span ${size}; grid-row: ${rowStart} / span ${size};`
                });
                cursor++; 
            } else {
                // FILLER
                const colStart = (gridCursor % numCols) + 1;
                const rowStart = Math.floor(gridCursor / numCols) + 1;
                markRegion(gridCursor, 1);
                displayList.push({
                    type: 'filler',
                    style: `grid-column: ${colStart} / span 1; grid-row: ${rowStart} / span 1;`
                });
            }
            gridCursor++;
        }
    }

    // 4. DECISION: WHICH LAYOUT TO USE?

    if (sortMode === "durationHigh" || sortMode === "durationLow") {
        // --- STRATEGY A: TIERED LAYOUT (Strict Buckets) ---
        
        // 1. Bucket the data
        let tier3 = [];
        let tier2 = [];
        let tier1 = [];

        filtered.forEach(d => {
            let cols = cellSizeMap[d.durationCategory] ? cellSizeMap[d.durationCategory].cols : 1;
            if (cols > numCols) cols = numCols;
            if (cols === 3) tier3.push(d);
            else if (cols === 2) tier2.push(d);
            else tier1.push(d);
        });

        // 2. Process strictly in order (Large -> Medium -> Small) or reverse if Low->High
        if (sortMode === "durationHigh") {
            // High to Low: 3 -> 2 -> 1
            if (tier3.length > 0) { processDataList(tier3); forceLineBreak(); }
            if (tier2.length > 0) { processDataList(tier2); forceLineBreak(); }
            if (tier1.length > 0) { processDataList(tier1); }
        } else {
            // Low to High: 1 -> 2 -> 3
            // (Usually low duration means small size, so we start with small)
            if (tier1.length > 0) { processDataList(tier1); forceLineBreak(); }
            if (tier2.length > 0) { processDataList(tier2); forceLineBreak(); }
            if (tier3.length > 0) { processDataList(tier3); }
        }

    } else {
        // --- STRATEGY B: STANDARD MIXED LAYOUT ---
        // Just process the filtered list as-is (respecting Newest, A-Z, etc.)
        processDataList(filtered);
    }

    // 5. Render
    grid.html("");
    const items = grid.selectAll(".item")
        .data(displayList)
        .enter()
        .append("div")
        .attr("class", d => d.type === 'data' ? "glyph" : "filler")
        .attr("style", d => d.style);

    items.filter(d => d.type === 'data')
        .html(d => drawGlyph(d.data))
        .on("mousemove", (event, d) => showTooltip(event, d.data))
        .on("mouseleave", hideTooltip);
}

// ----------------------------------------------------
// REAL-TIME CLOCK
// ----------------------------------------------------
function updateClock() {
    const now = new Date();
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const dateString = `
${months[now.getMonth()]} ${String(now.getDate()).padStart(2,'0')}, ${String(now.getFullYear()).slice(2)}
${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}
`.trim();

    document.getElementById("current-date").innerText = dateString;
}

setInterval(updateClock, 1000);
updateClock();

// ----------------------------------------------------
// CUSTOM DROPDOWN INIT (Replaces default <select>)
// ----------------------------------------------------
function initCustomDropdown() {
    const originalSelect = document.getElementById("sort-select");
    if (!originalSelect) return;

    // 1. Create the wrapper
    const wrapper = document.createElement("div");
    wrapper.classList.add("custom-select-wrapper");
    originalSelect.parentNode.insertBefore(wrapper, originalSelect);
    wrapper.appendChild(originalSelect); // Move original select inside (it will be hidden)

    // 2. Create the Trigger (The visible button)
    const trigger = document.createElement("div");
    trigger.classList.add("custom-select-trigger");
    trigger.innerHTML = `
        <span>${originalSelect.options[originalSelect.selectedIndex].text}</span>
        <div class="arrow"></div>
    `;
    wrapper.appendChild(trigger);

    // 3. Create the Options Container
    const optionsList = document.createElement("div");
    optionsList.classList.add("custom-options");
    wrapper.appendChild(optionsList);

    // 4. Populate Options
    for (const option of originalSelect.options) {
        const customOption = document.createElement("span");
        customOption.classList.add("custom-option");
        customOption.dataset.value = option.value;
        customOption.textContent = option.text;
        
        if (option.selected) {
            customOption.classList.add("selected");
        }

        // Handle Click Selection
        customOption.addEventListener("click", function() {
            // Update Visuals
            trigger.querySelector("span").textContent = this.textContent;
            wrapper.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("selected"));
            this.classList.add("selected");
            wrapper.classList.remove("open");

            // Sync with Original Select
            originalSelect.value = this.dataset.value;
            
            // Trigger Change Event (so your sorting logic runs!)
            const event = new Event('change');
            originalSelect.dispatchEvent(event);
        });

        optionsList.appendChild(customOption);
    }

    // 5. Toggle Open/Close
    trigger.addEventListener("click", function() {
        wrapper.classList.toggle("open");
    });

    // 6. Close when clicking outside
    document.addEventListener("click", function(e) {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove("open");
        }
    });
}

// CALL THE FUNCTION
initCustomDropdown();