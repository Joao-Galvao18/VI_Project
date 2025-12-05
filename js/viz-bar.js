import { state, countryColors } from './store.js';
import { hideTooltip } from './ui.js'; // We only need hideTooltip from UI

let barInitialized = false;
let svg, g, xScale, yScale, xAxisG, yAxisG;
let currentMode = "shape"; // "shape" or "country"
const margin = { top: 20, right: 20, bottom: 60, left: 60 };

// Map codes to nice names for the tooltip
const countryNames = {
    us: "UNITED STATES",
    gb: "GREAT BRITAIN",
    ca: "CANADA",
    au: "AUSTRALIA",
    de: "GERMANY",
    unknown: "UNKNOWN LOCATION"
};

export function initBar() {
    barInitialized = false;
    d3.select("#view-bar svg").remove();

    const container = d3.select("#view-bar");
    const rect = container.node().getBoundingClientRect();
    const width = rect.width || 800;
    const height = (rect.height || 600) - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("class", "bar-svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Setup Scales
    xScale = d3.scaleBand().range([0, width - margin.left - margin.right]).padding(0.2);
    yScale = d3.scaleLinear().range([height, 0]);

    // Setup Axis Groups
    xAxisG = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
    yAxisG = g.append("g").attr("class", "y-axis");

    // Button Listeners
    d3.select("#bar-btn-shape").on("click", function() { setMode(this, "shape"); });
    d3.select("#bar-btn-country").on("click", function() { setMode(this, "country"); });

    barInitialized = true;
    updateBar();
}

function setMode(btn, mode) {
    currentMode = mode;
    d3.selectAll("#bar-controls .filter-btn").classed("active", false);
    d3.select(btn).classed("active", true);
    updateBar();
}

export function updateBar() {
    if (!barInitialized) return;
    
    // Update Stats
    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);

    // 1. Aggregate Data
    const counts = new Map();
    state.filtered.forEach(d => {
        let key = currentMode === "shape" ? d.shape : d.country;
        if (!key || key === "") key = "unknown";
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    // Convert to Array and Sort (Highest first)
    let data = Array.from(counts, ([key, value]) => ({ key, value }));
    data.sort((a, b) => b.value - a.value);

    // 2. Update Domains
    xScale.domain(data.map(d => d.key));
    yScale.domain([0, d3.max(data, d => d.value) || 10]);

    // 3. Draw Axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).ticks(5);

    xAxisG.transition().duration(500).call(xAxis);
    yAxisG.transition().duration(500).call(yAxis);

    // Style Axes
    d3.selectAll(".bar-svg text").attr("fill", "#f8c200").attr("font-family", "VT323").style("font-size", "16px");
    d3.selectAll(".bar-svg line, .bar-svg path").attr("stroke", "#f8c200");

    // Rotated text if many shapes
    if (currentMode === "shape") {
        xAxisG.selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em");
    } else {
        // Reset rotation for countries
        xAxisG.selectAll("text").attr("transform", null).style("text-anchor", "middle").attr("dx", "0").attr("dy", "1em");
    }

    // 4. Draw Bars
    const bars = g.selectAll(".bar-rect").data(data, d => d.key);

    bars.exit()
        .transition().duration(300)
        .attr("y", yScale(0))
        .attr("height", 0)
        .remove();

    bars.enter()
        .append("rect")
        .attr("class", "bar-rect")
        .attr("x", d => xScale(d.key))
        .attr("width", xScale.bandwidth())
        .attr("y", yScale(0)) // Start at bottom for animation
        .attr("height", 0)
        .merge(bars)
        .on("mousemove", (event, d) => showBarTooltip(event, d)) // Use custom tooltip
        .on("mouseleave", hideTooltip)
        .transition().duration(500)
        .attr("x", d => xScale(d.key))
        .attr("y", d => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", d => yScale(0) - yScale(d.value))
        .attr("fill", d => {
            if (currentMode === "country") {
                return countryColors[d.key] || "#f8c200";
            }
            return "#f8c200"; // Default yellow for shapes
        });
}

// --- CUSTOM TOOLTIP FOR BAR CHART ---
function showBarTooltip(event, d) {
    const t = d3.select("#tooltip");
    
    // Determine Label (Translate "us" to "UNITED STATES")
    let label = d.key.toUpperCase();
    if (currentMode === "country" && countryNames[d.key]) {
        label = countryNames[d.key];
    }

    // Simple, clean HTML
    const html = `CATEGORY: ${label}\nTOTAL: ${d.value} SIGHTINGS`;
    
    t.html(html);

    // Positioning Logic
    const padding = 20;
    let x = event.clientX + padding;
    let y = event.clientY + padding;

    // Keep tooltip on screen
    if (x + 220 > window.innerWidth) x = event.clientX - 230;
    if (y + 100 > window.innerHeight) y = event.clientY - 100;

    t.style("left", x + "px")
     .style("top", y + "px")
     .style("opacity", 1);
}