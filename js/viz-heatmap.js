import { state, countryColors } from './store.js';
import { showTooltip, hideTooltip } from './ui.js';

// VARIÁVEIS GLOBAIS DE CONTROLO DO HEATMAP
let heatmapInitialized = false;
let svg, g, xScale, yScale, colorScale;
let currentMode = "count";
// AJUSTE DE MARGENS: Reduzi Top e Bottom para o gráfico ocupar mais espaço
const margin = { top: 30, right: 20, bottom: 50, left: 60 };

// MAPEAMENTO DE CÓDIGOS DE PAÍS PARA NOMES CURTOS
const countryLabels = {
    us: "USA", gb: "UK", ca: "CAN", au: "AUS", de: "DEU", unknown: "?"
};

// INICIALIZAÇÃO DO SVG E ESTRUTURA DO HEATMAP
export function initHeatmap() {
    heatmapInitialized = false;
    d3.select("#view-heatmap svg").remove();

    const container = d3.select("#view-heatmap");
    const rect = container.node().getBoundingClientRect();
    
    const width = rect.width || 800;
    const height = (rect.height || 600) - margin.top - margin.bottom;

    // CRIAÇÃO DO CANVAS SVG
    svg = container.append("svg")
        .attr("class", "heatmap-svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${rect.width} ${rect.height}`);

    g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // GRUPO PARA A LEGENDA
    // AJUSTE DE POSIÇÃO: Mudei de +35 para +15 para aproximar a legenda do gráfico
    svg.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${margin.left}, ${height + margin.top + 15})`);

    // DEFINIÇÃO DAS ESCALAS (BANDAS PARA GRELHA)
    xScale = d3.scaleBand().range([0, width - margin.left - margin.right]).padding(0.05);
    yScale = d3.scaleBand().range([0, height]).padding(0.05);
    
    // ESCALA DE COR (SQRT PARA MELHOR DISTRIBUIÇÃO VISUAL)
    colorScale = d3.scaleSqrt().range(["#331a00", "#ffcc00"]);

    // DEFINIÇÃO DO GRADIENTE PARA A LEGENDA
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "heatmap-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    linearGradient.append("stop").attr("offset", "0%").attr("stop-color", "#331a00");
    linearGradient.append("stop").attr("offset", "100%").attr("stop-color", "#ffcc00");

    // LISTENERS DOS BOTÕES DE MODO
    d3.select("#hm-btn-count").on("click", function() { setMode(this, "count"); });
    d3.select("#hm-btn-dur").on("click", function() { setMode(this, "duration"); });
    d3.select("#hm-btn-country").on("click", function() { setMode(this, "country"); });

    heatmapInitialized = true;
    updateHeatmap();
}

// ALTERNA O MODO DE VISUALIZAÇÃO (CONTAGEM, DURAÇÃO, PAÍS)
function setMode(btn, mode) {
    currentMode = mode;
    d3.selectAll("#heatmap-controls .filter-btn").classed("active", false);
    d3.select(btn).classed("active", true);
    updateHeatmap();
}

// LÓGICA PRINCIPAL DE RENDERIZAÇÃO E PROCESSAMENTO DE DADOS
export function updateHeatmap() {
    if (!heatmapInitialized) return;

    // ATUALIZA OS CONTADORES NA UI
    d3.select("#showing-count").text(state.filtered.length);
    d3.select("#total-count").text(state.rawData.length);

    const data = state.filtered;
    const { yearMin, yearMax } = state.filters;
    
    // GERA ARRAY DE ANOS NO INTERVALO SELECIONADO
    const years = [];
    for (let y = yearMin; y <= yearMax; y++) years.push(y);

    let plotData = [];
    let maxValue = 0;

    // --- MODO POR PAÍS (EIXO Y = PAÍSES, EIXO X = ANOS) ---
    if (currentMode === "country") {
        const countries = ["us", "gb", "ca", "au"];
        
        // INICIALIZA OS BUCKETS VAZIOS
        const buckets = new Map();
        countries.forEach(c => {
            years.forEach(y => {
                buckets.set(`${c}-${y}`, { 
                    xVal: y, yVal: c, count: 0, 
                    id: `${c}-${y}` 
                });
            });
        });

        // PREENCHE OS BUCKETS COM DADOS
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
        // --- MODO PADRÃO (EIXO Y = ANOS, EIXO X = MESES) ---
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        
        // INICIALIZA BUCKETS MÊS/ANO
        const buckets = new Map();
        years.forEach(y => {
            months.forEach((m, i) => {
                buckets.set(`${y}-${i}`, { 
                    xVal: m, yVal: y, count: 0, totalDur: 0, 
                    monthIndex: i, id: `${y}-${i}` 
                });
            });
        });

        // PREENCHE BUCKETS E SOMA DURAÇÕES
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
        
        // CALCULA O VALOR MÁXIMO PARA A ESCALA DE COR
        maxValue = d3.max(plotData, d => {
            return currentMode === "count" ? d.count : (d.count > 0 ? d.totalDur / d.count : 0);
        }) || 1;
        colorScale.domain([0, maxValue]);
    }

    // --- DESENHO DOS EIXOS ---
    
    g.selectAll(".x-axis").remove();
    const xAxis = d3.axisTop(xScale).tickSize(0);
    
    // REDUZ O NÚMERO DE TICKS SE HOUVER MUITOS ANOS (MODO PAÍS)
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
    
    // REDUZ O NÚMERO DE TICKS NO EIXO VERTICAL SE NECESSÁRIO
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

    // --- RENDERIZAÇÃO DAS CÉLULAS (RETÂNGULOS) ---

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
        .transition().duration(0) // ATUALIZAÇÃO INSTANTÂNEA PARA PERFORMANCE
        .attr("x", d => xScale(d.xVal))
        .attr("y", d => yScale(d.yVal))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill", d => {
            // LÓGICA DE COR PARA MODO PAÍS (USAR CORES DO TEMA)
            if (currentMode === "country") {
                if (d.count === 0) return "rgba(248, 194, 0, 0.08)";
                const baseColor = countryColors[d.yVal] || "#f8c200";
                return baseColor;
            }
            
            // LÓGICA DE COR PARA MAPA DE CALOR (GRADIENTE)
            const val = currentMode === "count" ? d.count : (d.count > 0 ? d.totalDur / d.count : 0);
            return val === 0 ? "rgba(248, 194, 0, 0.08)" : colorScale(val);
        })
        .style("opacity", d => {
            return 1;
        });
    
    // ATUALIZA A LEGENDA APÓS O REDESENHO
    drawLegend(maxValue);
}

// FUNÇÃO PARA DESENHAR A LEGENDA DINÂMICA
function drawLegend(maxValue) {
    const legendG = d3.select(".legend-group");
    legendG.html(""); // Limpa legenda anterior

    if (currentMode === "country") {
        // LEGENDA PARA O MODO PAÍS (CATEGÓRICO)
        const countries = ["us", "gb", "ca", "au"];
        let xOffset = 0;

        countries.forEach(c => {
            const color = countryColors[c];
            const name = countryLabels[c];
            
            // Caixa de cor
            legendG.append("rect")
                .attr("x", xOffset)
                .attr("y", 0)
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", color);

            // Texto
            legendG.append("text")
                .attr("x", xOffset + 20)
                .attr("y", 12)
                .text(name)
                .attr("fill", "#f8c200")
                .attr("font-family", "VT323")
                .style("font-size", "14px");

            xOffset += 60; // Espaçamento
        });

    } else {
        // LEGENDA PARA MODOS NUMÉRICOS (GRADIENTE)
        const barWidth = 200;
        
        // Barra Gradiente
        legendG.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", barWidth)
            .attr("height", 15)
            .style("fill", "url(#heatmap-gradient)");

        // Texto Mínimo (0)
        legendG.append("text")
            .attr("x", 0)
            .attr("y", 30)
            .text("0")
            .attr("fill", "#f8c200")
            .attr("font-family", "VT323")
            .style("font-size", "14px");

        // Texto Máximo (Valor Dinâmico)
        const maxText = currentMode === "count" ? maxValue : Math.round(maxValue) + "s";
        
        legendG.append("text")
            .attr("x", barWidth)
            .attr("y", 30)
            .attr("text-anchor", "end")
            .text(maxText)
            .attr("fill", "#f8c200")
            .attr("font-family", "VT323")
            .style("font-size", "14px");

        // Label do Título
        legendG.append("text")
            .attr("x", barWidth + 10)
            .attr("y", 12)
            .text(currentMode === "count" ? "SIGHTINGS INTENSITY" : "AVG DURATION")
            .attr("fill", "#f8c200")
            .attr("font-family", "VT323")
            .style("font-size", "14px");
    }
}

// TOOLTIP ESPECÍFICO PARA O HEATMAP
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
    // AJUSTE DE POSIÇÃO PARA NÃO SAIR DA TELA
    if (x + 220 > window.innerWidth) x = event.clientX - 230;
    
    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}