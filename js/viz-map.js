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

    mapSvg = container.append("svg")
        .attr("class", "map-svg")
        .attr("viewBox", `0 0 ${width} ${height}`);
    
    // PROJEÇÃO MERCATOR
    projection = d3.geoMercator()
        .scale(130)
        .translate([width / 2, height / 1.5]);

    path = d3.geoPath().projection(projection);

    // CONFIGURAÇÃO DO ZOOM
    zoom = d3.zoom()
        .scaleExtent([1, 50])
        .translateExtent([[-width, -height], [width * 2, height * 2]])
        .on("zoom", (event) => {
            const transform = event.transform;
            mapG.attr("transform", transform);

            mapG.selectAll(".map-marker")
                .attr("r", 3.5 / transform.k); 

            mapG.selectAll(".country").attr("stroke-width", 0.5 / transform.k);
            mapG.selectAll(".state-borders").attr("stroke-width", 0.3 / transform.k);
        });

    mapSvg.call(zoom);
    mapG = mapSvg.append("g");

    // CARREGAMENTO DUPLO DE DADOS (MUNDO + ESTADOS EUA)
    Promise.all([
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"), 
        d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")       
    ]).then(([world, us]) => {
        
        const countries = topojson.feature(world, world.objects.countries);
        
        mapG.append("path")
            .datum(d3.geoGraticule())
            .attr("class", "graticule")
            .attr("d", path);

        // DESENHA PAÍSES
        mapG.selectAll("path.country")
            .data(countries.features)
            .enter().append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", "rgba(248, 194, 0, 0.05)")
            .attr("stroke", "#f8c200")
            .attr("stroke-width", "0.5px");

        // DESENHA FRONTEIRAS DOS ESTADOS (EUA)
        const statesMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
        
        mapG.append("path")
            .datum(statesMesh)
            .attr("class", "state-borders") 
            .attr("d", path)
            .attr("fill", "none")
            .attr("stroke", "#f8c200")
            .attr("stroke-width", "0.3px")
            .attr("stroke-opacity", "0.5")
            .style("pointer-events", "none"); 

        mapInitialized = true;
        updateMap();
    });

    // CONTROLOS DE ZOOM MANUAL
    d3.select("#zoom-in").on("click", () => mapSvg.transition().call(zoom.scaleBy, 1.5));
    d3.select("#zoom-out").on("click", () => mapSvg.transition().call(zoom.scaleBy, 0.75));
    d3.select("#zoom-reset").on("click", () => mapSvg.transition().call(zoom.transform, d3.zoomIdentity));
}

export function updateMap() {
    if (!mapInitialized) return;
    
    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);
    
    // OBTER O NÍVEL DE ZOOM ATUAL
    const currentTransform = d3.zoomTransform(mapSvg.node());
    const currentK = currentTransform.k || 1;

    mapG.selectAll(".map-marker").remove();
    
    // DESENHO DOS PONTOS
    mapG.selectAll(".map-marker")
        .data(state.filtered)
        .enter().append("circle")
        .attr("class", "map-marker")
        .attr("cx", d => { 
            const c = projection([d.longitude, d.latitude]); 
            return c ? c[0] : null; 
        })
        .attr("cy", d => { 
            const c = projection([d.longitude, d.latitude]); 
            return c ? c[1] : null; 
        })
        .filter(function() { return d3.select(this).attr("cx") != null; })
        
        // AUMENTADO DE 2 PARA 3.5
        .attr("r", 3.5 / currentK) 
        
        .attr("fill", "#f8c200")
        .attr("opacity", 0.8)
        .on("mousemove", (event, d) => showTooltip(event, d))
        .on("mouseleave", hideTooltip);
}