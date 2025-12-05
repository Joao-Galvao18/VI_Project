import { state, countryColors } from './store.js';
import { showTooltip, hideTooltip } from './ui.js';

let scatterInitialized = false;
let svg, g, xScale, yScale, xAxisG, yAxisG;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };

export function initScatter() {
    scatterInitialized = false;
    d3.select("#view-scatter svg").remove();

    const container = d3.select("#view-scatter");
    const rect = container.node().getBoundingClientRect();
    const width = rect.width || 800;
    const height = (rect.height || 600) - margin.top - margin.bottom;

    svg = container.append("svg")
        .attr("class", "scatter-svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Setup Scales
    xScale = d3.scaleTime().range([0, width - margin.left - margin.right]);
    // Always Log Scale now
    yScale = d3.scaleLog().range([height, 0]);

    // Axes Groups
    xAxisG = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
    yAxisG = g.append("g").attr("class", "y-axis");

    // Add Axis Labels
    svg.append("text")
        .attr("x", width - margin.right)
        .attr("y", height + margin.top + 30)
        .attr("text-anchor", "end")
        .attr("fill", "#f8c200")
        .attr("font-family", "VT323")
        .text("SIGHTING DATE");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 15)
        .attr("x", 0 - (margin.top + 20))
        .attr("text-anchor", "end")
        .attr("fill", "#f8c200")
        .attr("font-family", "VT323")
        .text("DURATION (LOG SCALE)");

    scatterInitialized = true;
    updateScatter();
}

export function updateScatter() {
    if (!scatterInitialized) return;

    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);

    // CRITICAL: Log scales crash on 0. We must filter out 0 durations.
    const data = state.filtered.filter(d => d.datetimeParsed && d.durationSeconds > 0);

    // 1. Set Domains
    const timeExtent = d3.extent(data, d => d.datetimeParsed);
    if (timeExtent[0]) {
        xScale.domain([new Date(timeExtent[0].getTime() - 86400000 * 30), new Date(timeExtent[1].getTime() + 86400000 * 30)]);
    }

    // Y Scale Logic (Logarithmic)
    const height = (svg.node().getBoundingClientRect().height || 600) - margin.top - margin.bottom;
    yScale.range([height, 0]);
    
    // Domain: 0.1 minutes to Max (clamped to prevent log(0) errors)
    // This ensures very short sightings (seconds) still appear near the bottom
    const maxDur = d3.max(data, d => d.durationSeconds / 60) || 120;
    yScale.domain([0.1, maxDur]); 

    // 2. Draw Axes
    const xAxis = d3.axisBottom(xScale).ticks(5);
    // ".1f" format makes log ticks readable (0.1, 1.0, 10.0)
    const yAxis = d3.axisLeft(yScale).ticks(5, ".1f"); 

    xAxisG.transition().duration(500).call(xAxis);
    yAxisG.transition().duration(500).call(yAxis);

    // Style Axes
    d3.selectAll(".scatter-svg text").attr("fill", "#f8c200").attr("font-family", "VT323").style("font-size", "14px");
    d3.selectAll(".scatter-svg line, .scatter-svg path").attr("stroke", "#f8c200");

    // 3. Draw Dots
    const dots = g.selectAll(".scatter-dot").data(data, d => d.id);

    dots.exit()
        .transition().duration(300)
        .attr("r", 0)
        .remove();

    dots.enter()
        .append("circle")
        .attr("class", "scatter-dot")
        .attr("r", 0)
        .attr("cx", d => xScale(d.datetimeParsed))
        .attr("cy", height) 
        .merge(dots)
        .on("mousemove", (event, d) => showScatterTooltip(event, d))
        .on("mouseleave", hideTooltip)
        .transition().duration(500)
        .attr("cx", d => xScale(d.datetimeParsed))
        .attr("cy", d => {
            const min = d.durationSeconds / 60;
            // Protect against values < 0.1 min (6 seconds) going off chart
            return yScale(min < 0.1 ? 0.1 : min);
        })
        .attr("r", 4)
        .attr("fill", d => countryColors[d.country] || "#999")
        .attr("fill-opacity", 0.7)
        .attr("stroke", "none");
}

function showScatterTooltip(event, d) {
    const t = d3.select("#tooltip");
    const mins = (d.durationSeconds / 60).toFixed(1);
    
    const html = `DATE: ${d.datetime}\nDURATION: ${mins} MIN\nCOUNTRY: ${d.country.toUpperCase()}\nSHAPE: ${d.shape.toUpperCase()}`;
    
    t.html(html);

    let x = event.clientX + 20;
    let y = event.clientY + 20;
    if (x + 220 > window.innerWidth) x = event.clientX - 230;
    if (y + 100 > window.innerHeight) y = event.clientY - 100;

    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}