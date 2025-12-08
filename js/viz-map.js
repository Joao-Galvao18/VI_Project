import { state } from './store.js';
import { showTooltip, hideTooltip } from './ui.js';

let mapInitialized = false;
let mapSvg, mapG, projection, path, zoom;

export function initMap() {
    mapInitialized = false;
    d3.select("#view-map svg").remove();

    const container = d3.select("#view-map");
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

export function updateMap() {
    if (!mapInitialized) return;
    
    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);
    
    mapG.selectAll(".map-marker").remove();
    mapG.selectAll(".map-marker").data(state.filtered).enter().append("circle").attr("class", "map-marker")
        .attr("cx", d => { const c = projection([d.longitude, d.latitude]); return c ? c[0] : null; })
        .attr("cy", d => { const c = projection([d.longitude, d.latitude]); return c ? c[1] : null; })
        .filter(function() { return d3.select(this).attr("cx") != null; })
        .attr("r", d => d.durationCategory === "long" ? 6 : d.durationCategory === "medium" ? 4 : 2)
        .on("mousemove", (event, d) => showTooltip(event, d)).on("mouseleave", hideTooltip);
}