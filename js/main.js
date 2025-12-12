import { loadData, setUpdateCallback, state, applyFilters } from './store.js';
import { initUI } from './ui.js';
import { updateGrid } from './viz-glyph.js';
import { initMap, updateMap } from './viz-map.js';
import { initTimeline, updateTimeline } from './viz-timeline.js';
import { initHeatmap, updateHeatmap } from './viz-heatmap.js';
import { initBar, updateBar } from './viz-bar.js';
import { initScatter, updateScatter } from './viz-scatter.js';

let currentView = "glyph";
let glitchEnabled = true;
let glitchTimer = null;

//DA SETUP AO UPDATE LOOP
setUpdateCallback(() => {
    if (currentView === "glyph") updateGrid();
    else if (currentView === "map") updateMap();
    else if (currentView === "timeline") updateTimeline();
    else if (currentView === "heatmap") updateHeatmap();
    else if (currentView === "bar") updateBar();
    else if (currentView === "scatter") updateScatter();
});

//INICIALIZA
loadData().then(() => {
    initUI();
    updateGrid();
    initGlitchController();
    initSystemModal();
});

//LOGICA DE TROCAR TABS
d3.selectAll(".mode").on("click", function() {

    if (this.id === "btn-about") return; 

    d3.selectAll(".mode").classed("active", false);
    d3.select(this).classed("active", true);
    
    const mode = d3.select(this).text().trim();
    
    if (mode === "MAP") switchView("map");
    else if (mode === "TIMELINE") switchView("timeline");
    else if (mode === "HEATMAP") switchView("heatmap");
    else if (mode === "BAR") switchView("bar");
    else if (mode === "SCATTER") switchView("scatter");
    else switchView("glyph");
});

function switchView(viewName) {
    currentView = viewName;
    
    // RESET AUTOMÁTICO DO FILTRO DE DURAÇÃO AO SAIR DO GLYPH
    if (viewName !== "glyph") {
        if (state.filters.durationCat !== "all") {
            state.filters.durationCat = "all";
            d3.selectAll("#glyph-controls .filter-btn").classed("active", false);
            d3.select("#glyph-controls .filter-btn[data-val='all']").classed("active", true);
            applyFilters();
        }
    }

//ESCONDE AS VISUALIZAÇÕES
    d3.select("#view-glyph").style("display", "none");
    d3.select("#view-map").style("display", "none");
    d3.select("#view-timeline").style("display", "none");
    d3.select("#view-heatmap").style("display", "none");
    d3.select("#view-bar").style("display", "none");
    d3.select("#view-scatter").style("display", "none");
    
//ESCONDE OS CONTROLOS DO HEADER
    d3.select("#map-controls").style("display", "none");
    d3.select("#glyph-controls").style("display", "none");
    d3.select("#heatmap-controls").style("display", "none");
    d3.select("#bar-controls").style("display", "none");

//LOGICA DE TROCAR OS CONTROLOS DEPENDENDO DE CADA VISUALIZACAO
    if (viewName === "glyph") {
        d3.select("#sort-container").style("display", "block");
    } else {
        d3.select("#sort-container").style("display", "none");
    }

    // INICIALIZAÇÃO ESPECÍFICA DE CADA VISTA
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

    } else if (viewName === "bar") {
        d3.select("#view-bar").style("display", "block");
        d3.select("#bar-controls").style("display", "flex");
        d3.select("#view-title").text("CATEGORICAL BREAKDOWN");
        initBar();

    } else if (viewName === "scatter") {
        d3.select("#view-scatter").style("display", "block");
        d3.select("#view-title").text("DURATION CORRELATION");
        initScatter();

    } else {
        d3.select("#view-glyph").style("display", "block");
        d3.select("#glyph-controls").style("display", "flex");
        d3.select("#view-title").text("VISUAL DATA MATRIX");
        updateGrid(); 
    }
}

// CONFIGURAÇÃO DO POPUP 'SOBRE'
function initSystemModal() {
    const modal = document.getElementById("about-modal");
    const btnOpen = document.getElementById("btn-about");
    const btnClose = document.getElementById("btn-close-about");
    const toggle = document.getElementById("glitch-toggle");

    btnOpen.addEventListener("click", () => {
        modal.style.display = "flex";
    });

    btnClose.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });

    toggle.addEventListener("change", (e) => {
        glitchEnabled = e.target.checked;
        
        if (glitchEnabled) {
            document.body.classList.remove("effects-off");
            window.triggerRandomGlitch();
        } else {
            document.body.classList.add("effects-off");
            if (glitchTimer) clearTimeout(glitchTimer);
            
            document.querySelectorAll('.glitch-tear, .glitch-rgb, .glitch-squash')
                .forEach(el => el.classList.remove('glitch-tear', 'glitch-rgb', 'glitch-squash'));
        }
    });
}

// CONTROLADOR DOS EFEITOS DE GLITCH
function initGlitchController() {
    const glitchClasses = ['glitch-tear', 'glitch-rgb', 'glitch-squash'];
    const targetSelectors = [
        'h1', 'h2', '.version', '.mode.active', 
        '.footer-section', '.filter-stats div', '#view-title', 'button.active'
    ];

    // FUNÇÃO GLOBAL PARA DISPARAR GLITCHES
    window.triggerRandomGlitch = function() {
        if (glitchTimer) clearTimeout(glitchTimer);
        
        if (!glitchEnabled) return;

        // APLICA EFEITO ALEATÓRIO EM ELEMENTO ALEATÓRIO
        if (Math.random() > 0.3) {
            const randomSelector = targetSelectors[Math.floor(Math.random() * targetSelectors.length)];
            const elements = document.querySelectorAll(randomSelector);
            
            if (elements.length > 0) {
                const target = elements[Math.floor(Math.random() * elements.length)];           
                const effect = glitchClasses[Math.floor(Math.random() * glitchClasses.length)];
                
                target.classList.add(effect);
                
                // REMOVE O EFEITO APÓS ALGUNS MILISSEGUNDOS
                setTimeout(() => {
                    target.classList.remove(effect);
                }, Math.random() * 200 + 50);
            }
        }
        
        // REINICIA O LOOP SE ESTIVER ATIVO
        if (glitchEnabled) {
            glitchTimer = setTimeout(window.triggerRandomGlitch, Math.random() * 2000 + 500);
        }
    }

    window.triggerRandomGlitch();
}

// AJUSTE AO REDIMENSIONAR A JANELA
window.addEventListener("resize", () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (currentView === "glyph") updateGrid();
        else if (currentView === "timeline") initTimeline();
        else if (currentView === "map") initMap();
        else if (currentView === "heatmap") initHeatmap();
        else if (currentView === "bar") initBar();
        else if (currentView === "scatter") updateScatter();
    }, 100);
});