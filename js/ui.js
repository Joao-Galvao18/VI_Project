import { state, applyFilters } from './store.js';

export function initUI() {
    initFilters();
    initSliders();
    initDurationButtons();
    initCustomDropdown();
    setupSortingListener();
    initClock();
}

function initFilters() {
    const countryList = ["us", "gb", "ca", "au"]; 
    const shapeList = [
        "circle", "disk", "light", "fireball", 
        "oval", "triangle", "formation", "cylinder", "unknown"
    ];

    const cDiv = d3.select("#filter-countries");
    cDiv.html(""); 
    
    countryList.forEach(c => {
        cDiv.append("div").attr("class", "tag").text(c.toUpperCase())
            .on("click", function () {
                if (state.filters.countries.has(c)) state.filters.countries.delete(c);
                else state.filters.countries.add(c);
                d3.select(this).classed("active", state.filters.countries.has(c));
                applyFilters();
            });
    });

    const sDiv = d3.select("#filter-shapes");
    sDiv.html(""); 

    shapeList.forEach(s => {
        sDiv.append("div").attr("class", "tag").text(s.toUpperCase())
            .on("click", function () {
                if (state.filters.shapes.has(s)) state.filters.shapes.delete(s);
                else state.filters.shapes.add(s);
                d3.select(this).classed("active", state.filters.shapes.has(s));
                applyFilters();
            });
    });
}

function initDurationButtons() {

    d3.selectAll("#glyph-controls .filter-btn").on("click", function() {
    d3.selectAll("#glyph-controls .filter-btn").classed("active", false);
    d3.select(this).classed("active", true);

    state.filters.durationCat = d3.select(this).attr("data-val");
    applyFilters();
    });
}

function initSliders() {
    const yearMinSlider = document.getElementById("year-min");
    const yearMaxSlider = document.getElementById("year-max");
    const durMinSlider = document.getElementById("duration-min");
    const durMaxSlider = document.getElementById("duration-max");

    function updateYear() {
        state.filters.yearMin = Math.min(parseInt(yearMinSlider.value), parseInt(yearMaxSlider.value) - 1);
        state.filters.yearMax = Math.max(parseInt(yearMinSlider.value) + 1, parseInt(yearMaxSlider.value));
        
        yearMinSlider.value = state.filters.yearMin;
        yearMaxSlider.value = state.filters.yearMax;
        
        document.getElementById("year-label-min").textContent = state.filters.yearMin;
        document.getElementById("year-label-max").textContent = state.filters.yearMax;
        document.getElementById("year-val-min").textContent = state.filters.yearMin;
        document.getElementById("year-val-max").textContent = state.filters.yearMax;
        applyFilters();
    }

    function updateDur() {
        state.filters.durMin = Math.min(parseInt(durMinSlider.value), parseInt(durMaxSlider.value) - 1);
        state.filters.durMax = Math.max(parseInt(durMinSlider.value) + 1, parseInt(durMaxSlider.value));
        
        durMinSlider.value = state.filters.durMin;
        durMaxSlider.value = state.filters.durMax;
        
        document.getElementById("dur-label-min").textContent = state.filters.durMin;
        document.getElementById("dur-label-max").textContent = state.filters.durMax;
        document.getElementById("dur-val-min").textContent = state.filters.durMin + "M";
        document.getElementById("dur-val-max").textContent = state.filters.durMax + "M";
        applyFilters();
    }

    yearMinSlider.oninput = updateYear;
    yearMaxSlider.oninput = updateYear;
    durMinSlider.oninput = updateDur;
    durMaxSlider.oninput = updateDur;
}

function setupSortingListener() {
    const select = document.getElementById("sort-select");
    if (!select) return;
    select.addEventListener("change", () => {
        state.filters.sortMode = select.value;
        applyFilters();
    });
}

function initCustomDropdown() {
    const originalSelect = document.getElementById("sort-select");
    if (!originalSelect) return;

    if (originalSelect.parentNode.classList.contains("custom-select-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("custom-select-wrapper");
    originalSelect.parentNode.insertBefore(wrapper, originalSelect);
    wrapper.appendChild(originalSelect);

    const trigger = document.createElement("div");
    trigger.classList.add("custom-select-trigger");
    trigger.innerHTML = `<span>${originalSelect.options[originalSelect.selectedIndex].text}</span><div class="arrow"></div>`;
    wrapper.appendChild(trigger);

    const optionsList = document.createElement("div");
    optionsList.classList.add("custom-options");
    wrapper.appendChild(optionsList);

    for (const option of originalSelect.options) {
        const customOption = document.createElement("span");
        customOption.classList.add("custom-option");
        customOption.dataset.value = option.value;
        customOption.textContent = option.text;
        if (option.selected) customOption.classList.add("selected");

        customOption.addEventListener("click", function() {
            trigger.querySelector("span").textContent = this.textContent;
            wrapper.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("selected"));
            this.classList.add("selected");
            wrapper.classList.remove("open");
            originalSelect.value = this.dataset.value;
            const event = new Event('change');
            originalSelect.dispatchEvent(event);
        });
        optionsList.appendChild(customOption);
    }

    trigger.addEventListener("click", () => wrapper.classList.toggle("open"));
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) wrapper.classList.remove("open");
    });
}

export function showTooltip(event, d) {
    const t = d3.select("#tooltip");
    const safe = (v, fallback = "Unknown") => (v === undefined || v === null || v === "" ? fallback : v);
    
    const html = `Date: ${safe(d.datetime)}\nLocation: ${safe(d.city)}, ${safe(d.state)}, ${safe(d.country, "").toUpperCase()}\nShape: ${safe(d.shape)}\nDuration: ${safe(d.durationSeconds)}s (${safe(d.durationCategory)})\n--------------------------------------------------\n${safe(d.comments, "(No comments)")}`;
    
    t.html(html);

    const tooltipWidth = 260;
    const tooltipHeight = 200;
    const padding = 20;

    let x = event.clientX + padding;
    let y = event.clientY + padding;

    if (x + tooltipWidth + padding > window.innerWidth) x = event.clientX - tooltipWidth - padding;
    if (y + tooltipHeight + padding > window.innerHeight) y = event.clientY - tooltipHeight - padding;

    t.style("left", x + "px").style("top", y + "px").style("opacity", 1);
}

export function hideTooltip() { 
    d3.select("#tooltip").style("opacity", 0); 
}

function initClock() {
    function updateClock() {
        const now = new Date();
        const str = `${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][now.getMonth()]} ${String(now.getDate()).padStart(2,'0')}, ${String(now.getFullYear()).slice(2)}\n${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        const el = document.getElementById("current-date");
        if(el) el.innerText = str;
    }
    setInterval(updateClock, 1000); 
    updateClock();
}