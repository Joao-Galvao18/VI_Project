// ----------------------------------------------------
// UFO DATA MATRIX — FULL ENGINE V2.0
// (Hybrid Grid + Retro Map + Custom UI)
// ----------------------------------------------------

let rawData = [];
let filtered = [];
let currentView = "glyph";

// Sets for filters
let activeCountries = new Set();
let activeShapes = new Set();
let activeDurationCat = "all"; // State variable for duration buttons

// Slider values
let yearMin = 1945;
let yearMax = 2015;
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

// Duration category → cell size logic
const cellSizeMap = {
    short:  { cols: 1, rows: 1 },
    medium: { cols: 2, rows: 2 },
    long:   { cols: 3, rows: 3 },
    unknown:{ cols: 1, rows: 1 }
};

// ----------------------------------------------------
// LOAD DATA
// ----------------------------------------------------
d3.json("data/ufo_sample_500_clean.json").then(data => {

    data.forEach(d => {
        d.datetimeParsed = d.datetimeISO ? new Date(d.datetimeISO) : null;
        if (isNaN(d.datetimeParsed)) d.datetimeParsed = null;
    });

    rawData = data;
    filtered = data;

    initFilters();
    initSliders();
    initCustomDropdown();
    initDurationButtons(); // Initialize new buttons
    setupSortingListener();
    
    // Initial Render
    applyFilters();
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

    const cDiv = d3.select("#filter-countries");
    countryList.forEach(c => {
        cDiv.append("div").attr("class", "tag").text(c.toUpperCase())
            .on("click", function () {
                if (activeCountries.has(c)) activeCountries.delete(c);
                else activeCountries.add(c);
                d3.select(this).classed("active", activeCountries.has(c));
                applyFilters();
            });
    });

    const sDiv = d3.select("#filter-shapes");
    shapeList.forEach(s => {
        sDiv.append("div").attr("class", "tag").text(s)
            .on("click", function () {
                if (activeShapes.has(s)) activeShapes.delete(s);
                else activeShapes.add(s);
                d3.select(this).classed("active", activeShapes.has(s));
                applyFilters();
            });
    });
}

// ----------------------------------------------------
// NEW: DURATION CATEGORY BUTTONS
// ----------------------------------------------------
function initDurationButtons() {
    d3.selectAll(".filter-btn").on("click", function() {
        // Remove active class from all
        d3.selectAll(".filter-btn").classed("active", false);
        // Add to clicked
        d3.select(this).classed("active", true);

        // Update State
        activeDurationCat = d3.select(this).attr("data-val");
        
        applyFilters();
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

    function updateYear() {
        yearMin = Math.min(parseInt(yearMinSlider.value), parseInt(yearMaxSlider.value) - 1);
        yearMax = Math.max(parseInt(yearMinSlider.value) + 1, parseInt(yearMaxSlider.value));
        yearMinSlider.value = yearMin;
        yearMaxSlider.value = yearMax;
        document.getElementById("year-label-min").textContent = yearMin;
        document.getElementById("year-label-max").textContent = yearMax;
        document.getElementById("year-val-min").textContent = yearMin;
        document.getElementById("year-val-max").textContent = yearMax;
        applyFilters();
    }

    function updateDur() {
        durMin = Math.min(parseInt(durMinSlider.value), parseInt(durMaxSlider.value) - 1);
        durMax = Math.max(parseInt(durMinSlider.value) + 1, parseInt(durMaxSlider.value));
        durMinSlider.value = durMin;
        durMaxSlider.value = durMax;
        document.getElementById("dur-label-min").textContent = durMin;
        document.getElementById("dur-label-max").textContent = durMax;
        document.getElementById("dur-val-min").textContent = durMin + "M";
        document.getElementById("dur-val-max").textContent = durMax + "M";
        applyFilters();
    }

    yearMinSlider.oninput = updateYear;
    yearMaxSlider.oninput = updateYear;
    durMinSlider.oninput = updateDur;
    durMaxSlider.oninput = updateDur;
}

// ----------------------------------------------------
// CUSTOM DROPDOWN UI
// ----------------------------------------------------
function initCustomDropdown() {
    const originalSelect = document.getElementById("sort-select");
    if (!originalSelect) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("custom-select-wrapper");
    originalSelect.parentNode.insertBefore(wrapper, originalSelect);
    wrapper.appendChild(originalSelect);

    const trigger = document.createElement("div");
    trigger.classList.add("custom-select-trigger");
    trigger.innerHTML = `<span>${originalSelect.options[originalSelect.selectedIndex].text}</span><div class="arrow"></div>`;
    wrapper.appendChild(trigger);

    const optionsList = document.createElement("div");
    optionsList.classList.add("custom-options");
    wrapper.appendChild(optionsList);

    for (const option of originalSelect.options) {
        const customOption = document.createElement("span");
        customOption.classList.add("custom-option");
        customOption.dataset.value = option.value;
        customOption.textContent = option.text;
        if (option.selected) customOption.classList.add("selected");

        customOption.addEventListener("click", function() {
            trigger.querySelector("span").textContent = this.textContent;
            wrapper.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("selected"));
            this.classList.add("selected");
            wrapper.classList.remove("open");
            originalSelect.value = this.dataset.value;
            const event = new Event('change');
            originalSelect.dispatchEvent(event);
        });
        optionsList.appendChild(customOption);
    }

    trigger.addEventListener("click", () => wrapper.classList.toggle("open"));
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) wrapper.classList.remove("open");
    });
}

// ----------------------------------------------------
// SORTING SYSTEM
// ----------------------------------------------------
function setupSortingListener() {
    const select = document.getElementById("sort-select");
    if (!select) return;

    select.addEventListener("change", () => {
        applySorting();
        if (currentView === "glyph") updateGrid();
        else if (currentView === "map") updateMap(); 
        else if (currentView === "timeline") updateTimeline();
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
            case "newest": return bTime - aTime;
            case "oldest": return aTime - bTime;
            case "durationHigh": return (b.durationSeconds || 0) - (a.durationSeconds || 0);
            case "durationLow": return (a.durationSeconds || 0) - (b.durationSeconds || 0);
            case "countryAZ": return (a.country || "").localeCompare(b.country || "");
            case "cityAZ": return (a.city || "").localeCompare(b.city || "");
            case "shapeAZ": return (a.shape || "").localeCompare(b.shape || "");
            default: return 0;
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
        const year = d.datetimeParsed ? d.datetimeParsed.getFullYear() : null;
        const yearOK = (year === null) || (year >= yearMin && year <= yearMax);
        const minutes = d.durationSeconds ? d.durationSeconds / 60 : 0;
        const durationOK = minutes >= durMin && minutes <= durMax;

        // DURATION CATEGORY FILTER
        let catOK = true;
        if (activeDurationCat !== "all") {
            catOK = (d.durationCategory === activeDurationCat);
        }

        return countryOK && shapeOK && yearOK && durationOK && catOK;
    });

    applySorting();

    if (currentView === "glyph") updateGrid();
    else if (currentView === "map") updateMap();
    else if (currentView === "timeline") updateTimeline();
}

// ----------------------------------------------------
// TAB SWITCHING LOGIC
// ----------------------------------------------------
d3.selectAll(".mode").on("click", function() {
    d3.selectAll(".mode").classed("active", false);
    d3.select(this).classed("active", true);
    const mode = d3.select(this).text().trim();

    if (mode === "MAP") switchView("map");
    else if (mode === "GLYPH") switchView("glyph");
    else if (mode === "TIMELINE") switchView("timeline");
});

function switchView(viewName) {
    currentView = viewName;
    d3.select("#view-glyph").style("display", "none");
    d3.select("#view-map").style("display", "none");
    d3.select("#view-timeline").style("display", "none");
    
    // Hide controls
    d3.select("#map-controls").style("display", "none");
    d3.select("#glyph-controls").style("display", "none");

    if (viewName === "map") {
        d3.select("#view-map").style("display", "block");
        d3.select("#map-controls").style("display", "flex");
        d3.select("#view-title").text("GLOBAL TRACKING MAP");
        
        d3.select("#view-map svg").remove();
        mapInitialized = false;
        initMap();
    } else if (viewName === "timeline") {
        d3.select("#view-timeline").style("display", "block");
        d3.select("#view-title").text("TEMPORAL ANALYSIS");
        
        d3.select("#view-timeline svg").remove();
        timelineInitialized = false;
        initTimeline();
    } else {
        d3.select("#view-glyph").style("display", "block");
        d3.select("#glyph-controls").style("display", "flex");
        d3.select("#view-title").text("VISUAL DATA MATRIX");
        updateGrid(); 
    }
}

// ----------------------------------------------------
// GRID ENGINE
// ----------------------------------------------------
function updateGrid() {
    const grid = d3.select("#glyph-grid");
    const container = document.getElementById("view-glyph"); 
    const sortMode = document.getElementById("sort-select").value;

    d3.select("#showing-count").text(filtered.length);
    d3.select("#total-count").text(rawData.length);

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
    items.filter(d => d.type === 'data').html(d => drawGlyph(d.data))
        .on("mousemove", (event, d) => showTooltip(event, d.data)).on("mouseleave", hideTooltip);
}

// ----------------------------------------------------
// MAP ENGINE
// ----------------------------------------------------
let mapInitialized = false;
let mapSvg, mapG, projection, path, zoom;

function initMap() {
    const container = d3.select("#view-map");
    // Get full dimension
    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;

    mapSvg = container.append("svg").attr("class", "map-svg").attr("viewBox", `0 0 ${width} ${height}`);
    projection = d3.geoMercator().scale(130).translate([width / 2, height / 1.5]);
    path = d3.geoPath().projection(projection);
    zoom = d3.zoom().scaleExtent([1, 8]).on("zoom", (event) => mapG.attr("transform", event.transform));

    mapSvg.call(zoom);
    mapG = mapSvg.append("g");

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(world => {
        const countries = topojson.feature(world, world.objects.countries);
        mapG.append("path").datum(d3.geoGraticule()).attr("class", "graticule").attr("d", path);
        mapG.selectAll("path.country").data(countries.features).enter().append("path").attr("class", "country").attr("d", path);
        mapInitialized = true;
        updateMap();
    });

    d3.select("#zoom-in").on("click", () => mapSvg.transition().call(zoom.scaleBy, 1.5));
    d3.select("#zoom-out").on("click", () => mapSvg.transition().call(zoom.scaleBy, 0.75));
    d3.select("#zoom-reset").on("click", () => mapSvg.transition().call(zoom.transform, d3.zoomIdentity));
}

function updateMap() {
    if (!mapInitialized) return;
    d3.select("#showing-count").text(filtered.length);
    d3.select("#total-count").text(rawData.length);
    mapG.selectAll(".map-marker").remove();
    mapG.selectAll(".map-marker").data(filtered).enter().append("circle").attr("class", "map-marker")
        .attr("cx", d => { const c = projection([d.longitude, d.latitude]); return c ? c[0] : null; })
        .attr("cy", d => { const c = projection([d.longitude, d.latitude]); return c ? c[1] : null; })
        .filter(function() { return d3.select(this).attr("cx") != null; })
        .attr("r", d => d.durationCategory === "long" ? 6 : d.durationCategory === "medium" ? 4 : 2)
        .on("mousemove", (event, d) => showTooltip(event, d)).on("mouseleave", hideTooltip);
}

// ----------------------------------------------------
// GLYPH DRAWER
// ----------------------------------------------------
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

// ----------------------------------------------------
// UTILS
// ----------------------------------------------------
function safe(v, fallback = "Unknown") { return (v === undefined || v === null || v === "" ? fallback : v); }

// FIX: SMART TOOLTIP POSITIONING
function showTooltip(event, d) {
    const t = d3.select("#tooltip");
    const html = `ID: ${safe(d.id)}\nDate: ${safe(d.datetime)}\nLocation: ${safe(d.city)}, ${safe(d.state)}, ${safe(d.country, "").toUpperCase()}\nShape: ${safe(d.shape)}\nDuration: ${safe(d.durationSeconds)}s (${safe(d.durationCategory)})\n--------------------------------------------------\n${safe(d.comments, "(No comments)")}`;
    
    // Set content first to check size if needed (using fixed width from CSS)
    t.html(html);

    const tooltipWidth = 260; // from CSS
    const tooltipHeight = 200; // approximation
    const padding = 20;

    let x = event.clientX + padding;
    let y = event.clientY + padding;

    // Check horizontal overflow (right edge)
    if (x + tooltipWidth + padding > window.innerWidth) {
        x = event.clientX - tooltipWidth - padding;
    }

    // Check vertical overflow (bottom edge)
    if (y + tooltipHeight + padding > window.innerHeight) {
        y = event.clientY - tooltipHeight - padding;
    }

    t.style("left", x + "px")
     .style("top", y + "px")
     .style("opacity", 1);
}

function hideTooltip() { d3.select("#tooltip").style("opacity", 0); }
function updateClock() {
    const now = new Date();
    const str = `${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][now.getMonth()]} ${String(now.getDate()).padStart(2,'0')}, ${String(now.getFullYear()).slice(2)}\n${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    document.getElementById("current-date").innerText = str;
}
setInterval(updateClock, 1000); updateClock();

// ----------------------------------------------------
// RESIZE LOGIC (HANDLES ALL VIEWS)
// ----------------------------------------------------
window.addEventListener("resize", () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (currentView === "glyph") {
            updateGrid();
        } else if (currentView === "timeline") {
            d3.select("#view-timeline svg").remove();
            timelineInitialized = false;
            initTimeline();
        } else if (currentView === "map") {
            d3.select("#view-map svg").remove();
            mapInitialized = false;
            initMap();
        }
    }, 100);
});

// ----------------------------------------------------
// TIMELINE ENGINE (Line Chart)
// ----------------------------------------------------
let timelineInitialized = false;
let timeSvg, timeG, xTime, yTime, lineGenerator;
// Reduced margins
const timeMargin = { top: 20, right: 20, bottom: 30, left: 40 };

function initTimeline() {
    const container = d3.select("#view-timeline");
    // Grab actual current width of the container
    const rect = container.node().getBoundingClientRect();
    const width = rect.width - timeMargin.left - timeMargin.right;
    const height = rect.height - timeMargin.top - timeMargin.bottom;

    timeSvg = container.append("svg")
        .attr("class", "timeline-svg")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    timeG = timeSvg.append("g")
        .attr("transform", `translate(${timeMargin.left},${timeMargin.top})`);

    xTime = d3.scaleLinear().range([0, width]);
    yTime = d3.scaleLinear().range([height, 0]);

    timeG.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
    timeG.append("g").attr("class", "y-axis");
    timeG.append("path").attr("class", "timeline-path");

    timelineInitialized = true;
    updateTimeline();
}

function updateTimeline() {
    if (!timelineInitialized) return;

    const counts = new Map();
    for (let y = yearMin; y <= yearMax; y++) counts.set(y, 0);

    filtered.forEach(d => {
        if (d.datetimeParsed) {
            const y = d.datetimeParsed.getFullYear();
            if (counts.has(y)) counts.set(y, counts.get(y) + 1);
        }
    });

    const timelineData = Array.from(counts, ([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);

    xTime.domain([yearMin, yearMax]);
    yTime.domain([0, d3.max(timelineData, d => d.count) || 10]).nice();

    const xAxis = d3.axisBottom(xTime).tickFormat(d3.format("d")).ticks(Math.floor(xTime.range()[0] / 50)); 
    const yAxis = d3.axisLeft(yTime);

    timeG.select(".x-axis").transition().call(xAxis);
    timeG.select(".y-axis").transition().call(yAxis);

    lineGenerator = d3.line()
        .x(d => xTime(d.year))
        .y(d => yTime(d.count))
        .curve(d3.curveMonotoneX);

    timeG.select(".timeline-path").datum(timelineData).transition().duration(500).attr("d", lineGenerator);

    const dots = timeG.selectAll(".timeline-dot").data(timelineData);
    dots.exit().remove();
    dots.enter().append("circle").attr("class", "timeline-dot").attr("r", 4)
        .merge(dots)
        .on("mousemove", (event, d) => showTimelineTooltip(event, d)).on("mouseleave", hideTooltip)
        .transition().duration(500)
        .attr("cx", d => xTime(d.year)).attr("cy", d => yTime(d.count));
}

function showTimelineTooltip(event, d) {
    const t = d3.select("#tooltip");
    t.html(`YEAR: ${d.year}\nSIGHTINGS: ${d.count}`);
    
    // Also using smart positioning for timeline tooltip
    const tooltipWidth = 260;
    const padding = 20;
    let x = event.clientX + padding;
    let y = event.clientY - 40;

    if (x + tooltipWidth + padding > window.innerWidth) {
        x = event.clientX - tooltipWidth - padding;
    }
    
    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}