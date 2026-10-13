const palette = {
    ink: "#21333a",
    muted: "#6b7b80",
    teal: "#187b79",
    orange: "#d77b45",
    purple: "#8070a8",
    green: "#6b9b78",
    blue: "#5488a0",
    line: "#dce5e1"
};

const stateCodes = {
    "New South Wales": "NSW",
    Victoria: "VIC",
    Queensland: "QLD",
    "Western Australia": "WA",
    "South Australia": "SA",
    Tasmania: "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT"
};

const stateTilePositions = {
    "Western Australia": [70, 175],
    "Northern Territory": [338, 60],
    Queensland: [500, 95],
    "South Australia": [282, 300],
    "New South Wales": [650, 278],
    Victoria: [480, 414],
    "Australian Capital Territory": [804, 272],
    Tasmania: [814, 447]
};

async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function loadCsv(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`);
    }
    const text = (await response.text()).replace(/^\uFEFF/, "");
    const lines = text.trim().split(/\r?\n/);
    const headers = parseCsvLine(lines.shift());
    return lines.map((line) => {
        const values = parseCsvLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    });
}

function parseCsvLine(line) {
    const values = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === "," && !quoted) {
            values.push(value);
            value = "";
        } else {
            value += character;
        }
    }

    values.push(value);
    return values;
}

function numberValue(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

async function embedSpec(containerId, specPath, prepare) {
    try {
        const spec = await loadJson(specPath);
        if (prepare) {
            await prepare(spec);
        }
        await vegaEmbed(`#${containerId}`, spec, {
            actions: false,
            renderer: "svg"
        });
    } catch (error) {
        const container = document.getElementById(containerId);
        if (container) {
            container.replaceChildren();
            const message = document.createElement("p");
            message.className = "chart-error";
            message.textContent = "This chart could not load its data. Check that the project is being served over localhost and try again.";
            container.appendChild(message);
        }
        console.error(`Chart ${containerId} failed to load.`, error);
    }
}

function splitBalanced(items) {
    const total = items.reduce((sum, item) => sum + item.Admissions, 0);
    let running = 0;
    let splitAt = 1;
    let bestDifference = total;

    for (let index = 1; index < items.length; index += 1) {
        running += items[index - 1].Admissions;
        const difference = Math.abs(total / 2 - running);
        if (difference < bestDifference) {
            bestDifference = difference;
            splitAt = index;
        }
    }

    return [items.slice(0, splitAt), items.slice(splitAt)];
}

function layoutTreemap(items, x, y, width, height, output) {
    if (items.length === 0) return;
    if (items.length === 1) {
        output.push({ ...items[0], x, y, x2: x + width, y2: y + height });
        return;
    }

    const [first, second] = splitBalanced(items);
    const total = items.reduce((sum, item) => sum + item.Admissions, 0);
    const firstValue = first.reduce((sum, item) => sum + item.Admissions, 0);
    const fraction = firstValue / total;

    if (width >= height) {
        const firstWidth = width * fraction;
        layoutTreemap(first, x, y, firstWidth, height, output);
        layoutTreemap(second, x + firstWidth, y, width - firstWidth, height, output);
    } else {
        const firstHeight = height * fraction;
        layoutTreemap(first, x, y, width, firstHeight, output);
        layoutTreemap(second, x, y + firstHeight, width, height - firstHeight, output);
    }
}

function shortenDiagnosis(label) {
    return label
        .replace(/^(PR|ED|\d+[A-Z]?)\s*[–-]\s*/, "")
        .replace(/^Diseases and Disorders of /, "")
        .replace(/^Diseases and Disorders of the /, "")
        .replace(/^Injuries, Poisoning and Toxic Effects of Drugs: /, "")
        .replace(/^Injuries, Poisoning and Toxic Effects of Drugs$/, "Injuries and poisoning");
}

async function makeCartogramData() {
    const states = await loadCsv("data/state-pressure.csv");
    const maxAdmissions = Math.max(...states.map((state) => numberValue(state.Admissions)));
    return states.map((state) => {
        const [x, y] = stateTilePositions[state.State];
        const admissions = numberValue(state.Admissions);
        const side = Math.sqrt(admissions / maxAdmissions) * 148;
        return {
            State: state.State,
            Code: stateCodes[state.State],
            Admissions: admissions,
            RatePer1000: numberValue(state.RatePer1000),
            x,
            y,
            x2: x + side,
            y2: y + side,
            LabelX: x + side / 2,
            LabelY: y + side / 2 - (side > 74 ? 6 : 0),
            CountLabel: side > 74 ? `${(admissions / 1e6).toFixed(2)}m` : ""
        };
    });
}

async function makeTreemapData() {
    const data = await loadCsv("data/diagnosis-groups.csv");
    const items = data
        .filter((item) => /^(PR|ED|\d{1,2}[A-Z]?)\s*[–-]/.test(item.Diagnosis))
        .map((item) => ({
            Diagnosis: item.Diagnosis,
            ShortName: shortenDiagnosis(item.Diagnosis),
            Admissions: numberValue(item.Admissions)
        }))
        .filter((item) => item.Admissions > 0)
        .sort((a, b) => b.Admissions - a.Admissions);
    const rectangles = [];
    layoutTreemap(items, 0, 0, 940, 480, rectangles);
    return rectangles.map((item) => ({
        ...item,
        LabelX: item.x + 12,
        LabelY: item.y + Math.min(23, (item.y2 - item.y) / 2),
        ValueY: item.y2 - 12,
        Label: item.x2 - item.x > 72 && item.y2 - item.y > 38 ? item.ShortName : "",
        ValueLabel: item.y2 - item.y > 58 ? `${item.Admissions.toLocaleString()} separations` : ""
    }));
}

function aggregateFlows(rows) {
    const cleanRows = rows.map((row) => ({
        Sector: row.Sector,
        Category: row.Category.replace(/\s+total$/i, ""),
        ServiceType: row.ServiceType,
        Value: numberValue(row.Separations)
    }));
    const categories = [...new Set(cleanRows.map((row) => row.Category))];
    const types = [...new Set(cleanRows.map((row) => row.ServiceType))];
    const columns = [
        [...new Set(cleanRows.map((row) => row.Sector))],
        categories,
        types
    ];
    const nodeWidth = 12;
    const columnX = [48, 408, 768];
    const gap = 10;
    const top = 38;
    const bottom = 476;
    const total = cleanRows.reduce((sum, row) => sum + row.Value, 0);
    const scales = columns.map((names) => (bottom - top - gap * (names.length - 1)) / total);
    const scale = Math.min(...scales);
    const nodes = [];

    columns.forEach((names, columnIndex) => {
        let y = top;
        for (const name of names) {
            const key = ["Sector", "Category", "ServiceType"][columnIndex];
            const value = cleanRows
                .filter((row) => row[key] === name)
                .reduce((sum, row) => sum + row.Value, 0);
            const height = value * scale;
            nodes.push({
                Name: name,
                Column: columnIndex,
                Value: value,
                X: columnX[columnIndex],
                X2: columnX[columnIndex] + nodeWidth,
                Y: y,
                Y2: y + height,
                MidY: y + height / 2,
                LabelX: columnX[columnIndex] + nodeWidth + 8,
                LabelY: y + height / 2,
                Label: height >= 17 ? name : ""
            });
            y += height + gap;
        }
    });

    const nodeLookup = new Map(nodes.map((node) => [`${node.Column}:${node.Name}`, node]));
    const offsets = new Map();
    const links = [];
    for (const row of cleanRows) {
        for (const [fromColumn, toColumn, from, to] of [
            [0, 1, row.Sector, row.Category],
            [1, 2, row.Category, row.ServiceType]
        ]) {
            const source = nodeLookup.get(`${fromColumn}:${from}`);
            const target = nodeLookup.get(`${toColumn}:${to}`);
            const key = `${fromColumn}:${from}:${toColumn}:${to}`;
            const sourceOffset = offsets.get(`out:${fromColumn}:${from}`) || 0;
            const targetOffset = offsets.get(`in:${toColumn}:${to}`) || 0;
            const height = row.Value * scale;
            offsets.set(`out:${fromColumn}:${from}`, sourceOffset + height);
            offsets.set(`in:${toColumn}:${to}`, targetOffset + height);
            const existing = links.find((link) => link.Key === key);
            if (existing) {
                existing.Value += row.Value;
            } else {
                links.push({
                    Key: key,
                    Source: from,
                    Target: to,
                    SourceColumn: fromColumn,
                    Value: row.Value,
                    X: source.X2,
                    X2: target.X,
                    Y: source.Y + sourceOffset + height / 2,
                    Y2: target.Y + targetOffset + height / 2,
                    Color: fromColumn === 0
                        ? (from === "Public hospitals" ? palette.teal : palette.orange)
                        : ["#187b79", "#5488a0", "#8070a8", "#d77b45", "#6b9b78", "#8f8774"][
                            categories.indexOf(from) % 6
                        ]
                });
            }
        }
    }

    return { nodes, links, total };
}

async function makeFacilityGrid() {
    const facilities = await loadJson("data/health-facilities.geojson");
    const longitudeStep = 2.5;
    const latitudeStep = 1.6;
    const bins = new Map();
    for (const feature of facilities.features) {
        const longitude = numberValue(feature.properties.longitude);
        const latitude = numberValue(feature.properties.latitude);
        const west = Math.floor(longitude / longitudeStep) * longitudeStep;
        const south = Math.floor(latitude / latitudeStep) * latitudeStep;
        const key = `${west}:${south}`;
        const bin = bins.get(key) || { west, south, count: 0, names: [] };
        bin.count += 1;
        if (feature.properties.organisation_name) {
            bin.names.push(feature.properties.organisation_name);
        }
        bins.set(key, bin);
    }

    return {
        type: "FeatureCollection",
        features: [...bins.values()]
            .filter((bin) => bin.count > 1)
            .map((bin) => ({
                type: "Feature",
                properties: {
                    Count: bin.count,
                    Facilities: bin.names.slice(0, 5).join(", ")
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [bin.west, bin.south],
                        [bin.west + longitudeStep, bin.south],
                        [bin.west + longitudeStep, bin.south + latitudeStep],
                        [bin.west, bin.south + latitudeStep],
                        [bin.west, bin.south]
                    ]]
                }
            }))
    };
}

async function renderDashboard() {
    const charts = [
        embedSpec("chart-admissions", "specs/01-admissions-trend.vl.json"),
        embedSpec("chart-state-rates", "specs/02-state-choropleth.vl.json"),
        embedSpec("chart-age-sex", "specs/03-mental-health-age-sex.vl.json"),
        embedSpec("chart-patient-days", "specs/05-patient-days.vl.json"),
        embedSpec("chart-admission-type", "specs/08-same-day-overnight.vl.json"),
        embedSpec("chart-monthly-urgency", "specs/09-monthly-urgency.vl.json"),
        embedSpec("chart-facilities", "specs/07-hospital-locations.vl.json"),
        embedSpec("chart-cartogram", "specs/04-state-cartogram.vl.json", async (spec) => {
            spec.data.values = await makeCartogramData();
        }),
        embedSpec("chart-diagnoses", "specs/06-diagnosis-treemap.vl.json", async (spec) => {
            spec.data.values = await makeTreemapData();
        }),
        embedSpec("chart-patient-flow", "specs/10-service-flow.vl.json", async (spec) => {
            const rows = await loadCsv("data/service-flows.csv");
            const { nodes, links } = aggregateFlows(rows);
            spec.layer[0].data.values = links;
            spec.layer[1].data.values = nodes;
            spec.layer[2].data.values = nodes;
            spec.layer[3].data.values = [
                { Label: "HOSPITAL SECTOR", X: 48, Y: 18 },
                { Label: "BROAD CATEGORY", X: 408, Y: 18 },
                { Label: "SERVICE TYPE", X: 768, Y: 18 }
            ];
        }),
        embedSpec("chart-facility-density", "specs/11-facility-density.vl.json", async (spec) => {
            spec.layer[1].data.values = await makeFacilityGrid();
            spec.layer[1].data.format = { type: "json", property: "features" };
        })
    ];

    await Promise.all(charts);
}

renderDashboard();
