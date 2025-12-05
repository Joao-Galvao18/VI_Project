// Global Configuration
export const countryColors = {
    us: "#f8c200", // USA
    gb: "#00eaff", // Great Britain
    au: "#ff00ff", // Australia
    ca: "#00ff7f", // Canada (Restored)
    unknown: "#333333" 
};

export const cellSizeMap = {
    short:  { cols: 1, rows: 1 },
    medium: { cols: 2, rows: 2 },
    long:   { cols: 3, rows: 3 },
    unknown:{ cols: 1, rows: 1 }
};

// State Container
export const state = {
    rawData: [],
    filtered: [],
    filters: {
        countries: new Set(),
        shapes: new Set(),
        durationCat: "all",
        yearMin: 1940,
        yearMax: 2015,
        durMin: 0,
        durMax: 120,
        sortMode: "newest"
    }
};

let onUpdate = () => {};
export function setUpdateCallback(fn) { onUpdate = fn; }

export function loadData() {
    return d3.csv("data/ufo_full.csv").then(data => {
        
        const cleanData = [];
        const parseDateTime = d3.timeParse("%m/%d/%Y %H:%M");
        const parsePosted = d3.timeParse("%m/%d/%Y");
        
        // --- STRICT COUNTRY LIST ---
        // Added "ca" back to the list.
        const allowedCountries = new Set(["us", "gb", "au", "ca"]);
        
        let rejectedCount = 0;

        data.forEach(row => {
            // 1. Normalize Keys
            let d = {};
            Object.keys(row).forEach(k => {
                const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
                d[cleanKey] = row[k];
            });

            // 2. STRICT Country Check
            const rawCountry = (d.country || "").toLowerCase().replace(/[^a-z]/g, "");
            
            // If it's not US, GB, AU, or CA -> REJECT IT
            if (!allowedCountries.has(rawCountry)) {
                rejectedCount++;
                return; 
            }

            // 3. Coordinate Check
            const lat = parseFloat(d.latitude);
            const lng = parseFloat(d.longitude);
            if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return; 

            // 4. Parse Dates
            const rawTime = d.datetime || "";
            const rawPosted = d.dateposted || "";
            
            let dateParsed = parseDateTime(rawTime);
            let postedParsed = parsePosted(rawPosted);

            if (!dateParsed) {
                const nativeDate = new Date(rawTime);
                if (!isNaN(nativeDate)) dateParsed = nativeDate;
            }

            if (dateParsed) {
                const duration = parseFloat(d.durationseconds) || 0;
                
                let cat = "unknown";
                if (duration < 300) cat = "short";
                else if (duration <= 1800) cat = "medium";
                else cat = "long";

                cleanData.push({
                    id: Math.random().toString(36).substr(2, 9),
                    datetime: rawTime,
                    datetimeParsed: dateParsed, 
                    datePostedParsed: postedParsed,
                    city: d.city || "Unknown",
                    state: d.state || "",
                    country: rawCountry, 
                    shape: (d.shape || "unknown").trim(),
                    durationSeconds: duration,
                    durationCategory: cat,
                    comments: d.comments || "",
                    latitude: lat,
                    longitude: lng
                });
            }
        });

        console.log(`Filter Report: Rejected ${rejectedCount} non-matching countries.`);
        console.log(`Kept ${cleanData.length} valid entries (US/GB/AU/CA).`);

        // 5. Shuffle to get a mix of years
        shuffleArray(cleanData);

        // 6. Slice top 1000
        state.rawData = cleanData.slice(0, 1000);
        
        // 7. Sort Chronologically
        state.rawData.sort((a, b) => b.datetimeParsed - a.datetimeParsed);

        applyFilters();
    });
}

// Fisher-Yates Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function applyFilters() {
    const f = state.filters;
    state.filtered = state.rawData.filter(d => {
        if (!d.datetimeParsed) return false;

        const countryOK = f.countries.size === 0 || f.countries.has(d.country);
        const shapeOK = f.shapes.size === 0 || f.shapes.has(d.shape);
        const year = d.datetimeParsed.getFullYear();
        const yearOK = (year >= f.yearMin && year <= f.yearMax);
        
        const minutes = d.durationSeconds ? d.durationSeconds / 60 : 0;
        const durationOK = minutes >= f.durMin && minutes <= f.durMax;

        let catOK = true;
        if (f.durationCat !== "all") {
            catOK = (d.durationCategory === f.durationCat);
        }

        return countryOK && shapeOK && yearOK && durationOK && catOK;
    });

    applySorting();
    onUpdate(); 
}

function applySorting() {
    const mode = state.filters.sortMode;
    state.filtered.sort((a, b) => {
        const aTime = a.datetimeParsed ? a.datetimeParsed.getTime() : 0;
        const bTime = b.datetimeParsed ? b.datetimeParsed.getTime() : 0;
        
        switch(mode) {
            case "newest": return bTime - aTime;
            case "oldest": return aTime - bTime;
            case "durationHigh": return (b.durationSeconds || 0) - (a.durationSeconds || 0);
            case "durationLow": return (a.durationSeconds || 0) - (b.durationSeconds || 0);
            case "countryAZ": return (a.country || "").localeCompare(b.country || "");
            case "shapeAZ": return (a.shape || "").localeCompare(b.shape || "");
            default: return 0;
        }
    });
}