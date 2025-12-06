import { loadData, setUpdateCallback } from './store.js';
import { initUI } from './ui.js';
import { updateGrid } from './viz-glyph.js';
import { initMap, updateMap } from './viz-map.js';
import { initTimeline, updateTimeline } from './viz-timeline.js';
import { initHeatmap, updateHeatmap } from './viz-heatmap.js';
import { initBar, updateBar } from './viz-bar.js';
import { initScatter, updateScatter } from './viz-scatter.js';
import { initPolar, updatePolar } from './viz-polar.js';

let currentView = "glyph";

// 1. Setup the Update Loop
setUpdateCallback(() => {
    if (currentView === "glyph") updateGrid();
    else if (currentView === "map") updateMap();
    else if (currentView === "timeline") updateTimeline();
    else if (currentView === "heatmap") updateHeatmap();
    else if (currentView === "bar") updateBar();
    else if (currentView === "scatter") updateScatter();
    else if (currentView === "polar") updatePolar();
});

// 2. Initialize App
loadData().then(() => {
    initUI();
    updateGrid();
});

// 3. Tab Switching Logic
d3.selectAll(".mode").on("click", function() {
    d3.selectAll(".mode").classed("active", false);
    d3.select(this).classed("active", true);
    
    const mode = d3.select(this).text().trim();
    
    if (mode === "MAP") switchView("map");
    else if (mode === "TIMELINE") switchView("timeline");
    else if (mode === "HEATMAP") switchView("heatmap");
    else if (mode === "BAR") switchView("bar");
    else if (mode === "SCATTER") switchView("scatter");
    else if (mode === "RADIAL") switchView("polar");
    else switchView("glyph");
});

function switchView(viewName) {
    currentView = viewName;
    
    // Hide ALL View Containers
    d3.select("#view-glyph").style("display", "none");
    d3.select("#view-map").style("display", "none");
    d3.select("#view-timeline").style("display", "none");
    d3.select("#view-heatmap").style("display", "none");
    d3.select("#view-bar").style("display", "none");
    d3.select("#view-scatter").style("display", "none");
    d3.select("#view-polar").style("display", "none");
    
    // Hide ALL Header Controls
    d3.select("#map-controls").style("display", "none");
    d3.select("#glyph-controls").style("display", "none");
    d3.select("#heatmap-controls").style("display", "none");
    d3.select("#bar-controls").style("display", "none");
    d3.select("#polar-controls").style("display", "none");

    // --- SORT VISIBILITY LOGIC ---
    if (viewName === "glyph") {
        d3.select("#sort-container").style("display", "block");
    } else {
        d3.select("#sort-container").style("display", "none");
    }
    // -----------------------------

    if (viewName === "map") {
        d3.select("#view-map").style("display", "block");
        d3.select("#map-controls").style("display", "flex");
        d3.select("#view-title").text("GLOBAL TRACKING MAP");
        initMap();

    } else if (viewName === "timeline") {
        d3.select("#view-timeline").style("display", "block");
        d3.select("#view-title").text("TEMPORAL ANALYSIS");
        initTimeline();

    } else if (viewName === "heatmap") {
        d3.select("#view-heatmap").style("display", "block");
        d3.select("#heatmap-controls").style("display", "flex");
        d3.select("#view-title").text("TEMPORAL DENSITY SCAN");
        initHeatmap();

    } else if (viewName === "bar") {
        d3.select("#view-bar").style("display", "block");
        d3.select("#bar-controls").style("display", "flex");
        d3.select("#view-title").text("CATEGORICAL BREAKDOWN");
        initBar();

    } else if (viewName === "scatter") {
        d3.select("#view-scatter").style("display", "block");
        d3.select("#view-title").text("DURATION CORRELATION");
        initScatter();

    } else if (viewName === "polar") { 
        d3.select("#view-polar").style("display", "block");
        d3.select("#polar-controls").style("display", "flex");
        d3.select("#view-title").text("RADIAL CENSUS");
        initPolar();

    } else {
        d3.select("#view-glyph").style("display", "block");
        d3.select("#glyph-controls").style("display", "flex");
        d3.select("#view-title").text("VISUAL DATA MATRIX");
        updateGrid(); 
    }
}

window.addEventListener("resize", () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (currentView === "glyph") updateGrid();
        else if (currentView === "timeline") initTimeline();
        else if (currentView === "map") initMap();
        else if (currentView === "heatmap") initHeatmap();
        else if (currentView === "bar") initBar();
        else if (currentView === "scatter") updateScatter();
        else if (currentView === "polar") initPolar();
    }, 100);
});