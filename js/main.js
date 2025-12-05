import { loadData, setUpdateCallback } from './store.js';
import { initUI } from './ui.js';
import { updateGrid } from './viz-glyph.js';
import { initMap, updateMap } from './viz-map.js';
import { initTimeline, updateTimeline } from './viz-timeline.js';
import { initHeatmap, updateHeatmap } from './viz-heatmap.js';

let currentView = "glyph";

// 1. Setup the Update Loop
// This runs whenever a filter or sorting option changes
setUpdateCallback(() => {
    if (currentView === "glyph") updateGrid();
    else if (currentView === "map") updateMap();
    else if (currentView === "timeline") updateTimeline();
    else if (currentView === "heatmap") updateHeatmap();
});

// 2. Initialize App
loadData().then(() => {
    initUI();
    // Initial render defaults to Glyph view
    updateGrid();
});

// 3. Tab Switching Logic
d3.selectAll(".mode").on("click", function() {
    // UI Update for nav buttons
    d3.selectAll(".mode").classed("active", false);
    d3.select(this).classed("active", true);
    
    // Determine which view to load
    const mode = d3.select(this).text().trim();
    
    if (mode === "MAP") switchView("map");
    else if (mode === "TIMELINE") switchView("timeline");
    else if (mode === "HEATMAP") switchView("heatmap");
    else switchView("glyph"); // Default
});

function switchView(viewName) {
    currentView = viewName;
    
    // Hide ALL View Containers
    d3.select("#view-glyph").style("display", "none");
    d3.select("#view-map").style("display", "none");
    d3.select("#view-timeline").style("display", "none");
    d3.select("#view-heatmap").style("display", "none");
    
    // Hide ALL Specific Header Controls
    d3.select("#map-controls").style("display", "none");
    d3.select("#glyph-controls").style("display", "none");
    d3.select("#heatmap-controls").style("display", "none");

    // Show Selected View & Corresponding Controls
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

    } else {
        // Glyph (Default)
        d3.select("#view-glyph").style("display", "block");
        d3.select("#glyph-controls").style("display", "flex");
        d3.select("#view-title").text("VISUAL DATA MATRIX");
        updateGrid(); 
    }
}

// 4. Resize Handling
// Ensures charts redraw correctly when window size changes
window.addEventListener("resize", () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (currentView === "glyph") updateGrid();
        else if (currentView === "timeline") initTimeline();
        else if (currentView === "map") initMap();
        else if (currentView === "heatmap") initHeatmap();
    }, 100);
});