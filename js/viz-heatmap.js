import { state, countryColors } from './store.js';
import { showTooltip, hideTooltip } from './ui.js';

let heatmapInitialized = false;
let svg, g, xScale, yScale, colorScale;
let currentMode = "count";
const margin = { top: 40, right: 20, bottom: 20, left: 60 };

const countryLabels = {
    us: "USA", gb: "UK", ca: "CAN", au: "AUS", de: "DEU", unknown: "?"
};

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
    
    colorScale = d3.scaleSqrt().range(["#331a00", "#ffcc00"]);

    d3.select("#hm-btn-count").on("click", function() { setMode(this, "count"); });
    d3.select("#hm-btn-dur").on("click", function() { setMode(this, "duration"); });
    d3.select("#hm-btn-country").on("click", function() { setMode(this, "country"); });

    heatmapInitialized = true;
    updateHeatmap();
}

function setMode(btn, mode) {
    currentMode = mode;
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
    
    const years = [];
    for (let y = yearMin; y <= yearMax; y++) years.push(y);

    let plotData = [];

    if (currentMode === "country") {
        const countries = ["us", "gb", "ca", "au"];
        
        const buckets = new Map();
        countries.forEach(c => {
            years.forEach(y => {
                buckets.set(`${c}-${y}`, { 
                    xVal: y, yVal: c, count: 0, 
                    id: `${c}-${y}` 
                });
            });
        });

        data.forEach(d => {
            if (!d.datetimeParsed) return;
            const y = d.datetimeParsed.getFullYear();
            if (y < yearMin || y > yearMax) return;
            
            const key = `${d.country}-${y}`;
            const b = buckets.get(key);
            if (b) b.count++;
        });

        plotData = Array.from(buckets.values());

        xScale.domain(years);
        yScale.domain(countries);

    } else {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        
        const buckets = new Map();
        years.forEach(y => {
            months.forEach((m, i) => {
                buckets.set(`${y}-${i}`, { 
                    xVal: m, yVal: y, count: 0, totalDur: 0, 
                    monthIndex: i, id: `${y}-${i}` 
                });
            });
        });

        data.forEach(d => {
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

        plotData = Array.from(buckets.values());

        xScale.domain(months);
        yScale.domain(years);
        
        const maxValue = d3.max(plotData, d => {
            return currentMode === "count" ? d.count : (d.count > 0 ? d.totalDur / d.count : 0);
        }) || 1;
        colorScale.domain([0, maxValue]);
    }

    g.selectAll(".x-axis").remove();
    const xAxis = d3.axisTop(xScale).tickSize(0);
    
    if (currentMode === "country" && years.length > 20) {
        xAxis.tickValues(years.filter(y => y % 5 === 0));
    }

    g.append("g").attr("class", "x-axis")
        .call(xAxis)
        .selectAll("text")
        .attr("fill", "#f8c200")
        .attr("font-family", "VT323")
        .style("font-size", "14px");

    g.selectAll(".y-axis").remove();
    const yAxis = d3.axisLeft(yScale).tickSize(0);
    
    if (currentMode !== "country" && years.length > 40) {
        yAxis.tickValues(years.filter(y => y % 5 === 0));
    }
    
    if (currentMode === "country") {
        yAxis.tickFormat(d => countryLabels[d] || d.toUpperCase());
    }

    g.append("g").attr("class", "y-axis")
        .call(yAxis)
        .selectAll("text")
        .attr("fill", "#f8c200")
        .attr("font-family", "VT323")
        .style("font-size", "14px");

    g.selectAll(".domain").remove();

    const cells = g.selectAll(".cell").data(plotData, d => d.id);

    cells.exit().remove();

    cells.enter()
        .append("rect")
        .attr("class", "cell")
        .attr("x", d => xScale(d.xVal))
        .attr("y", d => yScale(d.yVal))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .style("stroke", "#000")
        .style("stroke-width", 1)
        .merge(cells)
        .on("mousemove", (event, d) => showHeatmapTooltip(event, d))
        .on("mouseleave", hideTooltip)
        .transition().duration(0)
        .attr("x", d => xScale(d.xVal))
        .attr("y", d => yScale(d.yVal))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill", d => {
            if (currentMode === "country") {
                if (d.count === 0) return "rgba(248, 194, 0, 0.08)";
                const baseColor = countryColors[d.yVal] || "#f8c200";
                return baseColor;
            }
            
            const val = currentMode === "count" ? d.count : (d.count > 0 ? d.totalDur / d.count : 0);
            return val === 0 ? "rgba(248, 194, 0, 0.08)" : colorScale(val);
        })
        .style("opacity", d => {
            return 1;
        });
}

function showHeatmapTooltip(event, d) {
    const t = d3.select("#tooltip");
    
    let html = "";
    if (currentMode === "country") {
        html = `YEAR: ${d.xVal}\nCOUNTRY: ${(countryLabels[d.yVal] || d.yVal).toUpperCase()}\nSIGHTINGS: ${d.count}`;
    } else {
        const val = currentMode === "count" ? d.count : (d.count > 0 ? Math.round(d.totalDur / d.count) : 0);
        const label = currentMode === "count" ? "SIGHTINGS" : "AVG DURATION (s)";
        html = `DATE: ${d.xVal} ${d.yVal}\n${label}: ${val}`;
    }
    
    t.html(html);
    
    let x = event.clientX + 20;
    let y = event.clientY + 20;
    if (x + 220 > window.innerWidth) x = event.clientX - 230;
    
    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}