// These colours coordinate the map, custom diagrams, and chart specifications.
const palette = {
    ink: "#21333a",
    muted: "#6b7b80",
    dark_teal: "#0f3d3e",
    teal: "#14746f",
    blue: "#88CCEE",
    orange: "#d77b45",
    yellow: "#b7c043",
    purple: "#AA4499",
    wine_red: "#882255",
    line: "#ffffff"
};

const maxStateSymbolSize = 46;

const formatCompact = (value) => {
        if (value >= 1_000_000) return `${value / 1_000_000}M`;
        if (value >= 1_000) return `${value / 1_000}k`;
        return value.toString();
    };

// Fetch JSON chart specs and GeoJSON files, surfacing HTTP failures to the chart loader.
async function loadJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Read a local CSV into row objects; strip a possible UTF-8 BOM before parsing headers.
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

// Parse one CSV row, including commas inside quoted fields and doubled quote escapes.
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

// Convert numeric fields safely; unparseable or missing values contribute zero in aggregates.
function numberValue(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

// Join country geometry to the filtered beds dataset by ISO code for the choropleth.
async function prepareHospitalBedsWorldMap(spec) {
    const [world, rows] = await Promise.all([
        loadJson("data/ne_110m_admin_0_countries.geojson"),
        loadCsv("data/hospital-beds-per-1000-people.filtered/hospital-beds-per-1000-people.csv")
    ]);
    const valuesByCode = new Map(rows.map((row) => [row.Code, row]));

    // Antarctica has no hospital-bed data and only adds empty space below the map.
    const countries = world.features
        .filter((feature) => feature.properties.ADMIN !== "Antarctica")
        .map((feature) => {
        const row = valuesByCode.get(feature.properties.ISO_A3_EH);
        const originalYear = row?.["Hospital beds (per 1,000 people) (Original Year)"];
        const bedsPer1000 = row ? Number(row["Hospital beds (per 1,000 people)"]) : null;
        const hasBedsValue = Number.isFinite(bedsPer1000);

        return {
            ...feature,
            HospitalBedsPer1000: hasBedsValue ? bedsPer1000 : null,
            HospitalBedsTooltip: hasBedsValue ? bedsPer1000.toFixed(2) : "No data",
            SourceYearTooltip: originalYear || row?.Year || "2021"
        };
    });
    spec.data = { values: countries };

    // Label Australia on the map with its value.
    const australia = countries.find((country) => country.properties.ADMIN === "Australia");
    if (australia && australia.HospitalBedsPer1000 !== null) {
        spec.layer[3].data.values[0].Label = `Australia: ${australia.HospitalBedsPer1000.toFixed(1)}`;
    }
}

// Display chart-specific fetch or rendering failures in the matching container.
function showChartError(containerId, error) {
    const container = document.getElementById(containerId);
    if (container) {
        container.replaceChildren();
        const message = document.createElement("p");
        message.className = "chart-error";
        message.textContent = "This chart could not load its data. Check that the project is being served over localhost and try again.";
        container.appendChild(message);
        const detail = document.createElement("p");
        detail.className = "chart-error";
        detail.textContent = `Details: ${error && error.message ? error.message : error}`;
        container.appendChild(detail);
    }
    console.error(`Chart ${containerId} failed to load.`, error);
}

// Load, optionally prepare, and render one Vega or Vega-Lite chart.
// Charts that split hospitals into public and private register their views here so one control can highlight both.
const sectorViews = [];
let sectorFocus = "all";

// Set the shared sector highlight ("all", "public" or "private") on every registered chart and button.
function setSectorFocus(value) {
    sectorFocus = value;
    sectorViews.forEach((view) => {
        try {
            view.signal("sectorFocus", value).run();
        } catch (error) {
            console.warn("Could not update the sector highlight on a chart.", error);
        }
    });
    document.querySelectorAll(".sector-toggle button").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.sector === value));
    });
}

function initSectorControl() {
    document.querySelectorAll(".sector-toggle button").forEach((button) => {
        button.addEventListener("click", () => setSectorFocus(button.dataset.sector));
    });
}

async function embedSpec(containerId, specPath, prepare, options = {}) {
    try {
        const spec = await loadJson(specPath);
        if (prepare) {
            await prepare(spec);
        }
        const result = await vegaEmbed(`#${containerId}`, spec, {
            actions: false,
            renderer: "svg"
        });
        if (options.sectorHighlight) {
            sectorViews.push(result.view);
            if (sectorFocus !== "all") result.view.signal("sectorFocus", sectorFocus).run();
        }
    } catch (error) {
        showChartError(containerId, error);
    }
}

// Choose a split near half the total value so treemap rectangles remain reasonably balanced.
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

// Recursively partition the available rectangle, assigning area in proportion to admissions.
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

// Remove source codes and repetitive wording from treemap labels without changing tooltip names.
function shortenDiagnosis(label) {
    return label
        .replace(/^(PR|ED|\d+[A-Z]?)\s*[–-]\s*/, "")
        .replace(/^Diseases and Disorders of the /, "")
        .replace(/^Diseases and Disorders of /, "")
        .replace(/^Injuries, Poisoning and Toxic Effects of Drugs: /, "")
        .replace(/^Injuries, Poisoning and Toxic Effects of Drugs$/, "Injuries and poisoning");
}

// Calculate a polygon ring's area and centroid using the shoelace formula.
function polygonCentroid(ring) {
    let twiceArea = 0;
    let longitudeTotal = 0;
    let latitudeTotal = 0;

    for (let index = 0; index < ring.length - 1; index += 1) {
        const [longitude, latitude] = ring[index];
        const [nextLongitude, nextLatitude] = ring[index + 1];
        const cross = longitude * nextLatitude - nextLongitude * latitude;
        twiceArea += cross;
        longitudeTotal += (longitude + nextLongitude) * cross;
        latitudeTotal += (latitude + nextLatitude) * cross;
    }

    if (twiceArea === 0) {
        return null;
    }

    return {
        area: Math.abs(twiceArea / 2),
        longitude: longitudeTotal / (3 * twiceArea),
        latitude: latitudeTotal / (3 * twiceArea)
    };
}

// Weight each state's polygon centroids by area to place one symbol per state or territory.
function stateCentroid(feature) {
    const polygons = feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    let areaTotal = 0;
    let longitudeTotal = 0;
    let latitudeTotal = 0;

    for (const polygon of polygons) {
        const centroid = polygonCentroid(polygon[0]);
        if (!centroid) continue;
        areaTotal += centroid.area;
        longitudeTotal += centroid.longitude * centroid.area;
        latitudeTotal += centroid.latitude * centroid.area;
    }

    if (areaTotal === 0) {
        throw new Error(`Could not calculate map position for ${feature.properties.STATE_NAME}`);
    }

    return [longitudeTotal / areaTotal, latitudeTotal / areaTotal];
}

// Pair state totals with boundary geometry and scale symbol area to public separations per 1,000 residents.
async function makeCartogramData(features) {
    const states = await loadCsv("data/state-pressure.csv");
    const maxRate = Math.max(...states.map((state) => numberValue(state.RatePer1000)));
    const featuresByState = new Map(features.map((feature) => [feature.properties.STATE_NAME, feature]));
    return states.map((state) => {
        const feature = featuresByState.get(state.State);
        if (!feature) {
            throw new Error(`No map boundary found for ${state.State}`);
        }
        const [longitude, latitude] = stateCentroid(feature);
        const admissions = numberValue(state.Admissions);
        const rate = numberValue(state.RatePer1000);
        return {
            State: state.State,
            Admissions: admissions,
            RatePer1000: rate,
            Longitude: longitude,
            Latitude: latitude,
            SymbolSize: Math.sqrt(rate / maxRate) * maxStateSymbolSize
        };
    });
}

// Pick round reference values (about four steps) up to the highest state rate.
function niceLegendValues(maxValue) {
    const rough = maxValue / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].map((multiple) => multiple * magnitude).find((value) => value >= rough);
    const values = [];
    for (let value = step; value <= maxValue + 1e-9; value += step) values.push(value);
    return values;
}

// Build a small reference legend using the same image and area-based scale as the map symbols.
function renderStateSymbolLegend(states) {
    const legend = document.getElementById("state-symbol-legend");
    if (!legend) return;

    const maxRate = Math.max(...states.map((state) => state.RatePer1000));
    const referenceValues = niceLegendValues(maxRate);

    legend.replaceChildren(...referenceValues.map((value) => {
        const item = document.createElement("li");
        item.setAttribute("aria-label", `${value.toLocaleString()} separations per 1,000 people`);
        const icon = document.createElement("img");
        icon.src = "data/hospital.png";
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        const size = Math.sqrt(value / maxRate) * maxStateSymbolSize;
        icon.width = size;
        icon.height = size;

        const label = document.createElement("span");
        label.textContent = value.toLocaleString();
        item.append(icon, label);
        return item;
    }));
}

// Prepare sorted diagnosis rectangles and wrap labels to fit their available cells.
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
    const chartRectangles = rectangles.map((item) => ({
        ...item,
        LabelX: item.x + 12,
        ValueY: item.y2 - 12
    }));
    const labels = [];
    const labelLineHeight = 20;
    const labelTopPadding = 16;

    for (const item of chartRectangles) {
        const width = item.x2 - item.x;
        const height = item.y2 - item.y;
        const maxCharacters = Math.floor((width - 24) / 8.2);
        const labelAreaHeight = height - (item.ValueLabel ? 30 : 8);
        const maxLines = Math.floor((labelAreaHeight - labelTopPadding - 8) / labelLineHeight);
        if (maxCharacters < 8 || maxLines < 1) continue;

        const words = item.ShortName.split(/\s+/);
        const lines = [];
        let line = "";
        for (const word of words) {
            if (word.length > maxCharacters) {
                if (line) lines.push(line);
                lines.push(`${word.slice(0, maxCharacters - 1)}…`);
                line = "";
                continue;
            }
            const candidate = line ? `${line} ${word}` : word;
            if (candidate.length > maxCharacters && line) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }
        if (line) lines.push(line);

        const visibleLines = lines.slice(0, maxLines);
        if (lines.length > maxLines) {
            const lastLine = visibleLines[visibleLines.length - 1];
            visibleLines[visibleLines.length - 1] =
                `${lastLine.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
        }

        const firstLineY = item.y + labelTopPadding;
        visibleLines.forEach((text, index) => {
            labels.push({
                LabelX: item.LabelX,
                LabelY: firstLineY + index * labelLineHeight,
                Label: text
            });
        });
    }

    return { rectangles: chartRectangles, labels };
}

// Aggregate the source records into three stages and place proportional nodes and curved ribbons.
function aggregateFlows(rows) {
    const cleanRows = rows.map((row) => ({
        Sector: row.Sector,
        Category: row.Category.replace(/\s+total$/i, ""),
        ServiceType: row.ServiceType,
        Value: numberValue(row.Separations)
    }));
    const sectorColors = {
        "Public hospitals": palette.purple,
        "Private hospitals": palette.yellow
    };
    const categoryColors = {
        Childbirth: palette.muted,
        "General intervention (surgical)": palette.muted,
        "Specific intervention (other)": palette.muted,
        "Mental health care": palette.muted,
        "Subacute and non-acute care": palette.muted,
        Medical: palette.muted
    };
    const serviceColors = {
        Childbirth: palette.muted,
        Emergency: palette.muted,
        "Non-emergency": palette.muted,
        "Mental health care": palette.muted,
        "Palliative care": palette.muted,
        "Other subacute and non-acute care": palette.muted,
        Rehabilitation: palette.muted
    };
    const nodeWidth = 20;
    const columnX = [160, 490, 820];
    const gap = 16;
    const top = 48;
    const bottom = 492;
    const total = cleanRows.reduce((sum, row) => sum + row.Value, 0);

    const stageFields = ["Sector", "ServiceType", "Category"]; // left to right: sector, service type, broad category
    const nodeTotals = stageFields.map((field) => {
        const values = new Map();
        for (const row of cleanRows) {
            values.set(row[field], (values.get(row[field]) || 0) + row.Value);
        }
        return [...values.entries()]
            .map(([Name, Value]) => ({ Name, Value }))
            .sort((a, b) => b.Value - a.Value);
    });

    // All three stages represent the same total; reserve enough vertical room for the busiest stage.
    const scale = Math.min(...nodeTotals.map((stage) =>
        (bottom - top - gap * (stage.length - 1)) / total
    ));
    const nodes = nodeTotals.flatMap((stage, columnIndex) => {
        let y = top;
        return stage.map(({ Name, Value }) => {
            const height = Value * scale;
            const LabelX = columnX[columnIndex] + nodeWidth + 10;
            const node = {
                Name,
                Column: columnIndex,
                Value,
                X: columnX[columnIndex],
                X2: columnX[columnIndex] + nodeWidth,
                Y: y,
                Y2: y + height,
                MidY: y + height / 2,
                LabelX,
                LabelY: y + height / 2,
                ValueY: y + height / 2 + 8,
                Label: Name,
                Color: columnIndex === 0
                    ? sectorColors[Name] || palette.ink
                    : columnIndex === 1
                        ? serviceColors[Name] || palette.purple
                        : categoryColors[Name] || palette.blue
            };
            y += height + gap;
            return node;
        });
    });

    const nodeLookup = new Map(nodes.map((node) => [`${node.Column}:${node.Name}`, node]));
    const edgeTotals = new Map();
    for (const row of cleanRows) {
        for (const [fromColumn, from, to] of [
            [0, row.Sector, row.ServiceType],
            [1, row.ServiceType, row.Category]
        ]) {
            const key = `${fromColumn}:${row.Sector}:${from}:${to}`;
            const edge = edgeTotals.get(key) || {
                Key: key,
                Source: from,
                Target: to,
                Sector: row.Sector,
                SourceColumn: fromColumn,
                Value: 0
            };
            edge.Value += row.Value;
            edgeTotals.set(key, edge);
        }
    }

    const edges = [...edgeTotals.values()];
    const sourceOffsets = new Map();
    const targetOffsets = new Map();
    const sourceOrder = new Map(nodes.map((node) => [`${node.Column}:${node.Name}`, node.MidY]));
    const orderedEdges = edges.sort((a, b) =>
        sourceOrder.get(`${a.SourceColumn}:${a.Source}`) -
        sourceOrder.get(`${b.SourceColumn}:${b.Source}`) ||
        (a.Sector === b.Sector ? 0 : a.Sector === "Public hospitals" ? -1 : 1) ||
        sourceOrder.get(`${a.SourceColumn + 1}:${a.Target}`) -
        sourceOrder.get(`${b.SourceColumn + 1}:${b.Target}`)
    );

    const links = orderedEdges.map((edge) => {
        const source = nodeLookup.get(`${edge.SourceColumn}:${edge.Source}`);
        const target = nodeLookup.get(`${edge.SourceColumn + 1}:${edge.Target}`);
        const height = edge.Value * scale;
        const sourceY = source.Y + (sourceOffsets.get(`${source.Column}:${source.Name}`) || 0);
        const targetY = target.Y + (targetOffsets.get(`${target.Column}:${target.Name}`) || 0);
        sourceOffsets.set(`${source.Column}:${source.Name}`,
            (sourceOffsets.get(`${source.Column}:${source.Name}`) || 0) + height);
        targetOffsets.set(`${target.Column}:${target.Name}`,
            (targetOffsets.get(`${target.Column}:${target.Name}`) || 0) + height);

        // Give each flow matching source and destination widths, joined by cubic curves.
        const x1 = source.X2;
        const x2 = target.X;
        const controlOffset = (x2 - x1) * 0.42;
        const Color = sectorColors[edge.Sector] || palette.blue;
        const xControl1 = x1 + controlOffset;
        const xControl2 = x2 - controlOffset;
        const path = [
            `M${x1},${sourceY}`,
            `C${xControl1},${sourceY} ${xControl2},${targetY} ${x2},${targetY}`,
            `L${x2},${targetY + height}`,
            `C${xControl2},${targetY + height} ${xControl1},${sourceY + height} ${x1},${sourceY + height}`,
            "Z"
        ].join("");

        return { ...edge, Color, Path: path };
    });

    return { nodes, links, total };
}

// Add prepared alluvial geometry and tooltip fields to the Vega specification.
async function prepareServiceFlow(spec) {
    const rows = await loadCsv("data/service-flows.csv");
    const { nodes, links, total } = aggregateFlows(rows);
    const nodeData = spec.data.find((dataset) => dataset.name === "nodes");
    const linkData = spec.data.find((dataset) => dataset.name === "links");
    if (!nodeData || !linkData) {
        throw new Error("The service-flow Vega specification is missing its nodes or links data source.");
    }

    nodeData.values = nodes.map((node) => ({
        ...node,
        Tooltip: {
            Category: node.Name,
            Separations: node.Value.toLocaleString(),
            Share: `${(node.Value / total * 100).toFixed(1)}%`
        }
    }));
    linkData.values = links.map((link) => ({
        ...link,
        Tooltip: {
            Sector: link.Sector,
            From: link.Source,
            To: link.Target,
            Separations: link.Value.toLocaleString(),
            Share: `${(link.Value / total * 100).toFixed(1)}%`
        }
    }));
}

// Expand 2024–25 totals into 100 cells, rounding the same-day share to the nearest percent.
async function makeAdmissionTypeWaffle() {
    const rows = await loadCsv("data/same-day-overnight.csv");
    const yearRows = rows.filter((row) => row.Year === "2024-25");
    const total = yearRows.reduce((sum, row) => sum + numberValue(row.Separations), 0);
    if (yearRows.length !== 2 || total <= 0) {
        throw new Error("Expected same-day and overnight separation totals for 2024-25.");
    }

    const records = yearRows.map((row) => ({
        Year: row.Year,
        AdmissionStatus: row.AdmissionStatus,
        Separations: numberValue(row.Separations),
        SharePercent: numberValue(row.Separations) / total * 100
    }));
    const sameDayCells = Math.round(
        records.find((row) => row.AdmissionStatus === "Same-day").SharePercent
    );

    return Array.from({ length: 100 }, (_, index) => ({
        ...records[index < sameDayCells ? 0 : 1],
        Column: index % 10,
        Row: Math.floor(index / 10)
    }));
}

// Label the end of each sector line directly (for example "Public 7.1m"), so readers need not match colours to the legend.
async function addSectorEndLabels(spec, csvPath, valueField) {
    const rows = (await loadCsv(csvPath)).filter((row) => /^(public|private) hospitals$/i.test(row.Sector));
    const lastYear = [...new Set(rows.map((row) => row.Year))].sort().pop();
    spec.layer[1].data = {
        values: rows.filter((row) => row.Year === lastYear).map((row) => {
            const value = numberValue(row[valueField]);
            return {
                Year: row.Year,
                Sector: row.Sector,
                [valueField]: value,
                Label: `${/^public/i.test(row.Sector) ? "Public" : "Private"} ${(value / 1_000_000).toFixed(1)}m`
            };
        })
    };
}

// Each entry connects an HTML container to a Vega or Vega-Lite spec.
// IDs, spec file names and the chart numbers on the page all share the same 01–12 order.
async function renderDashboard() {
    initSectorControl();
    const charts = [
        // 01 World choropleth
        embedSpec("chart-01-world-beds", "specs/01-world-beds-choropleth.vl.json", prepareHospitalBedsWorldMap),

        // 02 Separations by sector over time
        embedSpec("chart-02-separations-trend", "specs/02-separations-trend.vl.json",
            (spec) => addSectorEndLabels(spec, "data/hospital_admissions.csv", "Admissions"), { sectorHighlight: true }),

        // 03 Proportional symbol map of public separations by state
        embedSpec("chart-03-state-separations", "specs/03-state-separations.vl.json", async (spec) => {
            const boundaries = await loadJson("data/australian-states.geojson");
            const states = await makeCartogramData(boundaries.features);
            spec.layer[0].data.values = boundaries.features;
            renderStateSymbolLegend(states);
            const imageLayer = spec.layer[1];
            const stateSymbols = states.map((state) => ({
                ...imageLayer,
                data: { values: [state] },
                mark: {
                    ...imageLayer.mark,
                    width: state.SymbolSize,
                    height: state.SymbolSize
                }
            }));
            spec.layer.splice(1, 1, ...stateSymbols);
        }),

        // 04 Treemap of diagnostic groups
        embedSpec("chart-04-diagnosis-treemap", "specs/04-diagnosis-treemap.vl.json", async (spec) => {
            const { rectangles, labels } = await makeTreemapData();
            // Figure-ground: the largest group is drawn in the darkest colour.
            const largest = Math.max(...rectangles.map((item) => item.Admissions));
            spec.data.values = rectangles.map((item) => ({ ...item, Highlight: item.Admissions === largest }));
            spec.layer[1].data = { values: labels };
        }),

        // 05 Population pyramid
        embedSpec("chart-05-age-sex", "specs/05-age-sex.vl.json"),

        // 06 Patient days by age group
        embedSpec("chart-06-patient-days-age", "specs/06-patient-days-age.vl.json", async (spec) => {
            // Figure-ground: age groups from 65 upwards are drawn in the strong colour.
            const rows = await loadCsv("data/patient-days-age-2024-25.csv");
            spec.data = {
                values: rows.map((row) => ({
                    ...row,
                    AgeOrder: numberValue(row.AgeOrder),
                    PatientDays: numberValue(row.PatientDays),
                    Older: parseInt(row.AgeGroup, 10) >= 65
                }))
            };
        }),

        // 07 Patient days by sector over time
        embedSpec("chart-07-patient-days-sector", "specs/07-patient-days-sector.vl.json",
            (spec) => addSectorEndLabels(spec, "data/patient-days-sector.csv", "PatientDays"), { sectorHighlight: true }),

        // 08 Waffle chart: same-day vs overnight
        embedSpec("chart-08-same-day-overnight", "specs/08-same-day-overnight.vl.json", async (spec) => {
            const cells = await makeAdmissionTypeWaffle();
            spec.data.values = cells;
        }),

        // 09 Alluvial flow: sector to service type
        embedSpec("chart-09-service-flow", "specs/09-service-flow.vg.json", prepareServiceFlow, { sectorHighlight: true }),

        // 10 Dot map of hospital locations
        embedSpec("chart-10-hospital-locations", "specs/10-hospital-locations.vl.json"),

        // 11 Matrix heatmap: remoteness area by year
        embedSpec("chart-11-separations-remoteness", "specs/11-separations-remoteness.vl.json", (spec) => {
            // Compact, square cells: size the grid from the available width (11 years by 5 areas), up to 72px per cell.
            const container = document.getElementById("chart-11-separations-remoteness");
            const available = (container ? container.clientWidth : 900) - 150; // room for the area labels
            const cell = Math.max(30, Math.min(72, Math.floor(available / 11)));
            spec.width = cell * 11;
            spec.height = cell * 5;
            if (cell < 62) spec.encoding.x.axis.labelAngle = -45;
        })
    ];

    // Start independent chart loads together rather than making the page wait on them sequentially.
    await Promise.all(charts);
}

renderDashboard();

// ---------------------------------------------------------------------------
// Reading width: keep every printed line of text to at most ten words.
// A block is narrowed only as far as needed, so short blocks keep their natural width.
// ---------------------------------------------------------------------------
const maxWordsPerLine = 10;

function mostWordsOnOneLine(element) {
    const lines = new Map();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const wordPattern = /\S+/g;
        let match;
        while ((match = wordPattern.exec(node.data)) !== null) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const rect = range.getClientRects()[0];
            if (!rect) continue;
            const line = Math.round(rect.top / 6);
            lines.set(line, (lines.get(line) || 0) + 1);
        }
    }
    return Math.max(0, ...lines.values());
}

function limitWordsPerLine(element) {
    element.style.maxWidth = "";
    let width = element.getBoundingClientRect().width;
    for (let attempt = 0; attempt < 40 && width > 140 && mostWordsOnOneLine(element) > maxWordsPerLine; attempt += 1) {
        width *= 0.94;
        element.style.maxWidth = `${Math.round(width)}px`;
    }
}

function limitAllTextLines() {
    document.querySelectorAll("main p, main dd, main li, main h1, main h2, main h3, header p, header h1, footer p")
        .forEach(limitWordsPerLine);
}

let textResizeTimer;
const startTextLimits = () => {
    limitAllTextLines();
    window.addEventListener("resize", () => {
        clearTimeout(textResizeTimer);
        textResizeTimer = setTimeout(limitAllTextLines, 150);
    });
};
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(startTextLimits);