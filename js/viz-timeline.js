import { state } from './store.js';
import { hideTooltip } from './ui.js';

let timelineInitialized = false;
let timeSvg, timeG, xTime, yTime, lineGenerator;
const timeMargin = { top: 20, right: 20, bottom: 30, left: 40 };

export function initTimeline() {
    timelineInitialized = false;
    d3.select("#view-timeline svg").remove();

    // CONFIGURAÇÃO DO CONTENTOR E DIMENSÕES
    const container = d3.select("#view-timeline");
    const rect = container.node().getBoundingClientRect();
    const width = rect.width - timeMargin.left - timeMargin.right;
    const height = rect.height - timeMargin.top - timeMargin.bottom;

    timeSvg = container.append("svg")
        .attr("class", "timeline-svg")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    timeG = timeSvg.append("g")
        .attr("transform", `translate(${timeMargin.left},${timeMargin.top})`);

    // DEFINIÇÃO DAS ESCALAS
    xTime = d3.scaleLinear().range([0, width]);
    yTime = d3.scaleLinear().range([height, 0]);

    // PREPARAÇÃO DOS EIXOS E DO CAMINHO DA LINHA
    timeG.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
    timeG.append("g").attr("class", "y-axis");
    timeG.append("path").attr("class", "timeline-path");

    timelineInitialized = true;
    updateTimeline();
}

// ATUALIZAÇÃO DA TIMELINE COM DADOS FILTRADOS
export function updateTimeline() {
    if (!timelineInitialized) return;

    // ATUALIZA ESTATÍSTICAS NA UI
    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);

    // AGREGAÇÃO DE DADOS POR ANO
    const counts = new Map();
    const { yearMin, yearMax } = state.filters;
    // INICIALIZA TODOS OS ANOS COM 0
    for (let y = yearMin; y <= yearMax; y++) counts.set(y, 0);

    // CONTA OCORRÊNCIAS
    state.filtered.forEach(d => {
        if (d.datetimeParsed) {
            const y = d.datetimeParsed.getFullYear();
            if (counts.has(y)) counts.set(y, counts.get(y) + 1);
        }
    });

    // CONVERTE PARA ARRAY E ORDENA POR ANO
    const timelineData = Array.from(counts, ([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);

    // ATUALIZAÇÃO DOS DOMÍNIOS DAS ESCALAS
    xTime.domain([yearMin, yearMax]);
    yTime.domain([0, d3.max(timelineData, d => d.count) || 10]).nice();

    // ATUALIZAÇÃO DOS EIXOS
    const xAxis = d3.axisBottom(xTime).tickFormat(d3.format("d")).ticks(Math.floor(xTime.range()[0] / 50)); 
    const yAxis = d3.axisLeft(yTime);

    timeG.select(".x-axis").transition().call(xAxis);
    timeG.select(".y-axis").transition().call(yAxis);

    // GERAÇÃO DA LINHA
    lineGenerator = d3.line()
        .x(d => xTime(d.year))
        .y(d => yTime(d.count))
        .curve(d3.curveMonotoneX);

    // DESENHO DA LINHA
    timeG.select(".timeline-path").datum(timelineData).transition().duration(500).attr("d", lineGenerator);

    // DESENHO DOS PONTOS INTERATIVOS
    const dots = timeG.selectAll(".timeline-dot").data(timelineData);
    dots.exit().remove();
    dots.enter().append("circle").attr("class", "timeline-dot").attr("r", 4)
        .merge(dots)
        .on("mousemove", (event, d) => showTimelineTooltip(event, d)).on("mouseleave", hideTooltip)
        .transition().duration(500)
        .attr("cx", d => xTime(d.year)).attr("cy", d => yTime(d.count));
}

// TOOLTIP ESPECÍFICO PARA A TIMELINE
function showTimelineTooltip(event, d) {
    const t = d3.select("#tooltip");
    t.html(`YEAR: ${d.year}\nSIGHTINGS: ${d.count}`);
    
    const tooltipWidth = 260;
    const padding = 20;
    let x = event.clientX + padding;
    let y = event.clientY - 40;

    if (x + tooltipWidth + padding > window.innerWidth) {
        x = event.clientX - tooltipWidth - padding;
    }
    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}