import { state } from './store.js';
import { showTooltip, hideTooltip } from './ui.js';

let heatmapInitialized = false;
let svg, g, xScale, yScale, colorScale;
let currentMetric = "count"; 
const margin = { top: 40, right: 20, bottom: 20, left: 40 };

export function initHeatmap() {
    heatmapInitialized = false;
    d3.select("#view-heatmap svg").remove();

    const container = d3.select("#view-heatmap");
    const rect = container.node().getBoundingClientRect();
    
    const width = rect.width || 800;
    const height = (rect.height || 600) - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("class", "heatmap-svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    xScale = d3.scaleBand().range([0, width - margin.left - margin.right]).padding(0.05);
    yScale = d3.scaleBand().range([0, height]).padding(0.05);
    
    // Sqrt scale for better visibility of low numbers
    colorScale = d3.scaleSqrt().range(["#331a00", "#ffcc00"]);

    // Clear old listeners before adding new ones to prevent duplicates
    d3.select("#hm-btn-count").on("click", null).on("click", function() { setMetric(this, "count"); });
    d3.select("#hm-btn-dur").on("click", null).on("click", function() { setMetric(this, "duration"); });

    heatmapInitialized = true;
    updateHeatmap();
}

function setMetric(btn, metric) {
    currentMetric = metric;
    d3.selectAll("#heatmap-controls .filter-btn").classed("active", false);
    d3.select(btn).classed("active", true);
    updateHeatmap();
}

export function updateHeatmap() {
    if (!heatmapInitialized) return;

    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);

    const data = state.filtered;
    const { yearMin, yearMax } = state.filters;
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    
    const years = [];
    for (let y = yearMin; y <= yearMax; y++) years.push(y);

    const buckets = new Map();
    years.forEach(y => {
        months.forEach((m, i) => {
            buckets.set(`${y}-${i}`, { count: 0, totalDur: 0, year: y, monthIndex: i, monthName: m });
        });
    });

    data.forEach(d => {
        // Safe check for valid parsed date
        if (!d.datetimeParsed) return;

        const y = d.datetimeParsed.getFullYear();
        if (y < yearMin || y > yearMax) return;
        
        const m = d.datetimeParsed.getMonth(); 
        const key = `${y}-${m}`;
        
        const b = buckets.get(key);
        if (b) {
            b.count++;
            b.totalDur += (d.durationSeconds || 0);
        }
    });

    const plotData = Array.from(buckets.values());

    xScale.domain(months);
    yScale.domain(years);

    const maxValue = d3.max(plotData, d => {
        return currentMetric === "count" ? d.count : (d.count > 0 ? d.totalDur / d.count : 0);
    }) || 1;

    colorScale.domain([0, maxValue]);

    // Draw X Axis
    g.selectAll(".x-axis").remove();
    g.append("g").attr("class", "x-axis")
        .call(d3.axisTop(xScale).tickSize(0))
        .selectAll("text")
        .attr("fill", "#f8c200")
        .attr("font-family", "VT323")
        .style("font-size", "14px");

    // Draw Y Axis
    g.selectAll(".y-axis").remove();
    const yAxis = d3.axisLeft(yScale).tickSize(0);
    // Reduce ticks if zoomed out
    if (years.length > 40) yAxis.tickValues(years.filter(y => y % 5 === 0));
    
    g.append("g").attr("class", "y-axis")
        .call(yAxis)
        .selectAll("text")
        .attr("fill", "#f8c200")
        .attr("font-family", "VT323")
        .style("font-size", "14px");

    g.selectAll(".domain").remove();

    // --- DRAW CELLS ---
    const cells = g.selectAll(".cell").data(plotData, d => `${d.year}-${d.monthIndex}`);

    // Remove old cells INSTANTLY (no transition)
    cells.exit().remove();

    // Update new and existing cells
    // IMPORTANT: I removed .transition() so the grid snaps instantly when filtering
    cells.enter()
        .append("rect")
        .attr("class", "cell")
        .merge(cells)
        .attr("x", d => xScale(d.monthName))
        .attr("y", d => yScale(d.year))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .style("stroke", "#000")
        .style("stroke-width", 1)
        .attr("fill", d => {
            const val = currentMetric === "count" ? d.count : (d.count > 0 ? d.totalDur / d.count : 0);
            return val === 0 ? "rgba(248, 194, 0, 0.08)" : colorScale(val);
        })
        .on("mousemove", (event, d) => showHeatmapTooltip(event, d))
        .on("mouseleave", hideTooltip);
}

function showHeatmapTooltip(event, d) {
    const t = d3.select("#tooltip");
    const val = currentMetric === "count" ? d.count : (d.count > 0 ? Math.round(d.totalDur / d.count) : 0);
    const label = currentMetric === "count" ? "SIGHTINGS" : "AVG DURATION (s)";
    
    t.html(`DATE: ${d.monthName} ${d.year}\n${label}: ${val}`);
    
    let x = event.clientX + 20;
    let y = event.clientY + 20;
    
    // Keep inside window
    if (x + 220 > window.innerWidth) x = event.clientX - 230;
    if (y + 100 > window.innerHeight) y = event.clientY - 100;
    
    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}