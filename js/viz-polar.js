import { state } from './store.js';
import { showTooltip, hideTooltip } from './ui.js';

let polarInitialized = false;
let svg, g, angleScale, radiusScale;
let currentMode = "shape"; 

// UPDATED Allowed Shapes
const mainShapes = new Set([
    "circle", "disk", "light", "fireball", 
    "oval", "triangle", "formation", "cylinder", "unknown"
]);

export function initPolar() {
    polarInitialized = false;
    d3.select("#view-polar svg").remove();

    const container = d3.select("#view-polar");
    const rect = container.node().getBoundingClientRect();
    const width = rect.width || 800;
    const height = (rect.height || 600);
    const radius = Math.min(width, height) / 2 - 40;

    svg = container.append("svg")
        .attr("class", "polar-svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    g = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // Scales
    angleScale = d3.scaleBand().range([0, 2 * Math.PI]).align(0);
    radiusScale = d3.scaleLinear().range([50, radius]);

    // Controls
    d3.select("#polar-btn-shape").on("click", function() { setMode(this, "shape"); });
    d3.select("#polar-btn-dur").on("click", function() { setMode(this, "duration"); });

    polarInitialized = true;
    updatePolar();
}

function setMode(btn, mode) {
    currentMode = mode;
    d3.selectAll("#polar-controls .filter-btn").classed("active", false);
    d3.select(btn).classed("active", true);
    updatePolar();
}

export function updatePolar() {
    if (!polarInitialized) return;

    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);

    // 1. Aggregate Data
    const counts = new Map();
    state.filtered.forEach(d => {
        let key = "unknown";
        if (currentMode === "shape") {
            if (mainShapes.has(d.shape)) key = d.shape;
            else key = "other";
        } else {
            key = d.durationCategory || "unknown";
        }
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    // Sort Data
    let data = Array.from(counts, ([key, value]) => ({ key, value }));
    data.sort((a, b) => b.value - a.value);

    // 2. Update Domains
    angleScale.domain(data.map(d => d.key));
    const maxVal = d3.max(data, d => d.value) || 10;
    radiusScale.domain([0, maxVal]);

    // 3. Define Arc
    const arc = d3.arc()
        .innerRadius(50)
        .outerRadius(d => radiusScale(d.value))
        .startAngle(d => angleScale(d.key))
        .endAngle(d => angleScale(d.key) + angleScale.bandwidth())
        .padAngle(0.05)
        .padRadius(50);

    // 4. Draw Radial Bars
    const bars = g.selectAll(".polar-path").data(data, d => d.key);

    bars.exit().transition().duration(300).style("opacity", 0).remove();

    bars.enter()
        .append("path")
        .attr("class", "polar-path")
        .attr("fill", "#f8c200")
        .attr("d", arc)
        .on("mousemove", (event, d) => showPolarBarTooltip(event, d))
        .on("mouseleave", hideTooltip)
        .merge(bars)
        .transition().duration(500)
        .attr("d", arc);

    // 5. Draw Numbers INSIDE
    g.selectAll(".polar-value").remove();
    g.selectAll(".polar-value").data(data).enter()
        .append("text")
        .attr("class", "polar-value")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("transform", d => {
            const centroid = arc.centroid(d);
            const angle = (angleScale(d.key) + angleScale.bandwidth() / 2) * 180 / Math.PI - 90;
            const rot = (angle > 90 || angle < -90) ? angle + 180 : angle;
            return `translate(${centroid[0]},${centroid[1]}) rotate(${rot})`;
        })
        .text(d => d.value)
        .attr("fill", "#000") 
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("pointer-events", "none"); 

    // 6. Draw Labels
    g.selectAll(".polar-label").remove();
    g.selectAll(".polar-label").data(data).enter()
        .append("text")
        .attr("class", "polar-label")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("transform", d => {
            const angle = angleScale(d.key) + angleScale.bandwidth() / 2 - Math.PI / 2;
            const r = radiusScale(d.value) + 20; 
            const degrees = angle * 180 / Math.PI;
            const flip = (degrees > 90 || degrees < -90) ? 180 : 0;
            return `rotate(${degrees}) translate(${r},0) rotate(${flip})`;
        })
        .text(d => d.key.toUpperCase())
        .attr("fill", "#f8c200")
        .style("font-size", "12px");
}

function showPolarBarTooltip(event, d) {
    const t = d3.select("#tooltip");
    const html = `CATEGORY: ${d.key.toUpperCase()}\nCOUNT: ${d.value}`;
    t.html(html);

    let x = event.clientX + 20;
    let y = event.clientY + 20;
    if (x + 220 > window.innerWidth) x = event.clientX - 230;
    if (y + 100 > window.innerHeight) y = event.clientY - 100;

    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}