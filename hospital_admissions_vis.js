// These colours coordinate the map, custom diagrams, and chart specifications.
const palette = {
    ink: "#21333a",
    muted: "#6b7b80",
    dark_teal: "#0f3d3e",
    teal: "#14746f",
    blue: "#88CCEE",
    orange: "#d77b45",
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

    spec.data = {
        values: world.features.map((feature) => {
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
        })
    };
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
    }
    console.error(`Chart ${containerId} failed to load.`, error);
}

// Load, optionally prepare, and render one Vega-Lite chart.
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

// Pair state totals with boundary geometry and scale symbol area to public separations.
async function makeCartogramData(features) {
    const states = await loadCsv("data/state-pressure.csv");
    const maxAdmissions = Math.max(...states.map((state) => numberValue(state.Admissions)));
    const featuresByState = new Map(features.map((feature) => [feature.properties.STATE_NAME, feature]));
    return states.map((state) => {
        const feature = featuresByState.get(state.State);
        if (!feature) {
            throw new Error(`No map boundary found for ${state.State}`);
        }
        const [longitude, latitude] = stateCentroid(feature);
        const admissions = numberValue(state.Admissions);
        return {
            State: state.State,
            Admissions: admissions,
            RatePer1000: numberValue(state.RatePer1000),
            Longitude: longitude,
            Latitude: latitude,
            SymbolSize: Math.sqrt(admissions / maxAdmissions) * maxStateSymbolSize
        };
    });
}

// Build a small reference legend using the same image and area-based scale as the map symbols.
function renderStateSymbolLegend(states) {
    const legend = document.getElementById("state-symbol-legend");
    if (!legend) return;

    const maxAdmissions = Math.max(...states.map((state) => state.Admissions));
    const referenceValues = [400_000, 800_000, 1_200_000, 1_600_000, 2_000_000]
        .filter((value) => value <= maxAdmissions);

    legend.replaceChildren(...referenceValues.map((value) => {
        const item = document.createElement("li");
        item.setAttribute("aria-label", `${value.toLocaleString()} separations`);
        const icon = document.createElement("img");
        icon.src = "data/hospital.png";
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        const size = Math.sqrt(value / maxAdmissions) * maxStateSymbolSize;
        icon.width = size;
        icon.height = size;

        const label = document.createElement("span");
        label.textContent = formatCompact(value);
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
        const maxCharacters = Math.floor((width - 24) / 7.5);
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
        "Private hospitals": palette.orange
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

    const stageFields = ["Sector", "Category", "ServiceType"];
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
                        ? categoryColors[Name] || palette.blue
                        : serviceColors[Name] || palette.purple
            };
            y += height + gap;
            return node;
        });
    });

    const nodeLookup = new Map(nodes.map((node) => [`${node.Column}:${node.Name}`, node]));
    const edgeTotals = new Map();
    for (const row of cleanRows) {
        for (const [fromColumn, from, to] of [
            [0, row.Sector, row.Category],
            [1, row.Category, row.ServiceType]
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

function createSvgElement(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [attribute, value] of Object.entries(attributes)) {
        element.setAttribute(attribute, value);
    }
    return element;
}

// Render the alluvial flow as SVG paths so each link can have a smooth, value-scaled ribbon.
async function renderServiceFlow() {
    try {
        const rows = await loadCsv("data/service-flows.csv");
        const { nodes, links, total } = aggregateFlows(rows);
        const container = document.getElementById("chart-patient-flow");
        if (!container) {
            throw new Error("Could not find the hospital service flow chart container.");
        }

        const svg = createSvgElement("svg", {
            viewBox: "0 0 1120 520",
            width: "100%",
            role: "img",
            "aria-label": "Hospital separations flowing from sector through care category to service type",
            preserveAspectRatio: "xMidYMid meet"
        });
        const description = createSvgElement("title");
        description.textContent = "Hospital separations flow from hospital sector through broad category to service type.";
        svg.appendChild(description);

        const columnHeadings = [
            ["HOSPITAL SECTOR", 167],
            ["BROAD CATEGORY", 497],
            ["SERVICE TYPE", 827]
        ];
        for (const [label, x] of columnHeadings) {
            const heading = createSvgElement("text", {
                x,
                y: 24,
                "text-anchor": "middle",
                "font-family": "Arial, sans-serif",
                "font-size": 17,
                "font-weight": 700,
                fill: palette.ink
            });
            heading.textContent = label;
            svg.appendChild(heading);
        }

        const tooltip = document.createElement("div");
        tooltip.id = "service-flow-tooltip";
        tooltip.className = "service-flow-tooltip";
        tooltip.setAttribute("role", "tooltip");
        tooltip.hidden = true;

        const showTooltip = (rows, clientX, clientY) => {
            const table = document.createElement("table");
            const body = document.createElement("tbody");
            for (const [label, value] of rows) {
                const row = document.createElement("tr");
                const heading = document.createElement("th");
                const cell = document.createElement("td");
                heading.scope = "row";
                heading.textContent = label;
                cell.textContent = value;
                row.append(heading, cell);
                body.appendChild(row);
            }
            table.appendChild(body);
            tooltip.replaceChildren(table);
            tooltip.hidden = false;
            const bounds = container.getBoundingClientRect();
            const left = Math.min(
                Math.max(clientX - bounds.left + 14, 8),
                bounds.width - tooltip.offsetWidth - 8
            );
            const top = Math.min(
                Math.max(clientY - bounds.top + 14, 8),
                bounds.height - tooltip.offsetHeight - 8
            );
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        const bindTooltip = (group, rows) => {
            group.setAttribute("tabindex", "0");
            group.setAttribute("aria-describedby", tooltip.id);
            const showAtPointer = (event) => showTooltip(rows, event.clientX, event.clientY);
            group.addEventListener("pointerenter", showAtPointer);
            group.addEventListener("pointermove", showAtPointer);
            group.addEventListener("pointerleave", () => {
                tooltip.hidden = true;
            });
            group.addEventListener("focus", () => {
                const bounds = group.getBoundingClientRect();
                showTooltip(rows, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
            });
            group.addEventListener("blur", () => {
                tooltip.hidden = true;
            });
        };

        for (const link of links) {
            const group = createSvgElement("g", {
                role: "graphics-symbol",
                "aria-label": `${link.Sector}: ${link.Source} to ${link.Target}: ${link.Value.toLocaleString()} separations`
            });
            const path = createSvgElement("path", {
                d: link.Path,
                fill: link.Color,
                opacity: 0.58
            });
            group.appendChild(path);
            bindTooltip(group, [
                ["Sector", link.Sector],
                ["From", link.Source],
                ["To", link.Target],
                ["Separations", link.Value.toLocaleString()],
                ["Share", `${(link.Value / total * 100).toFixed(1)}%`]
            ]);
            svg.appendChild(group);
        }

        for (const node of nodes) {
            const group = createSvgElement("g", {
                role: "graphics-symbol",
                "aria-label": `${node.Name}: ${node.Value.toLocaleString()} separations, ${(node.Value / total * 100).toFixed(1)} percent`
            });
            const rect = createSvgElement("rect", {
                x: node.X,
                y: node.Y,
                width: node.X2 - node.X,
                height: node.Y2 - node.Y,
                fill: node.Color
            });
            group.appendChild(rect);
            bindTooltip(group, [
                ["Category", node.Name],
                ["Separations", node.Value.toLocaleString()],
                ["Share", `${(node.Value / total * 100).toFixed(1)}%`]
            ]);

            if (node.Label) {
                const label = createSvgElement("text", {
                    x: node.Column === 0 ? node.X - 10 : node.LabelX,
                    y: node.LabelY,
                    "text-anchor": node.Column === 0 ? "end" : "start",
                    "dominant-baseline": "middle",
                    "font-family": "Arial, sans-serif",
                    "font-size": 15,
                    "font-weight": 600,
                    fill: palette.ink,
                    stroke: "#ffffff",
                    "stroke-width": 5,
                    "stroke-linejoin": "round",
                    "paint-order": "stroke"
                });
                label.textContent = node.Label;
                group.appendChild(label);
            }
            if (node.ValueLabel) {
                const valueLabel = createSvgElement("text", {
                    x: node.Column === 0 ? node.X - 10 : node.LabelX,
                    y: node.ValueY,
                    "text-anchor": node.Column === 0 ? "end" : "start",
                    "dominant-baseline": "middle",
                    "font-family": "Arial, sans-serif",
                    "font-size": 15,
                    fill: palette.ink,
                    stroke: "#ffffff",
                    "stroke-width": 4,
                    "stroke-linejoin": "round",
                    "paint-order": "stroke"
                });
                valueLabel.textContent = node.ValueLabel;
                group.appendChild(valueLabel);
            }
            svg.appendChild(group);
        }

        container.replaceChildren(svg);
        container.appendChild(tooltip);
    } catch (error) {
        showChartError("chart-patient-flow", error);
    }
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

// Each entry connects an HTML container to a Vega-Lite spec; custom charts receive data before embedding.
async function renderDashboard() {
    const charts = [
        embedSpec("chart-admissions", "specs/01-admissions-trend.vl.json"),
        embedSpec("chart-state-rates", "specs/02-state-choropleth.vl.json", prepareHospitalBedsWorldMap),
        embedSpec("chart-age-sex", "specs/03-age-sex.vl.json"),
        embedSpec("chart-patient-days-age", "specs/12-patient-days-age.vl.json"),
        embedSpec("chart-patient-days", "specs/05-patient-days.vl.json"),
        embedSpec("chart-admission-type", "specs/08-same-day-overnight.vl.json?v=2", async (spec) => {
            spec.data.values = await makeAdmissionTypeWaffle();
        }),
        embedSpec("chart-facilities", "specs/07-hospital-locations.vl.json"),
        embedSpec("chart-cartogram", "specs/04-state-cartogram.vl.json", async (spec) => {
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
        embedSpec("chart-diagnoses", "specs/06-diagnosis-treemap.vl.json", async (spec) => {
            const { rectangles, labels } = await makeTreemapData();
            spec.data.values = rectangles;
            spec.layer[1].data = { values: labels };
        }),
        renderServiceFlow()
    ];

    // Start independent chart loads together rather than making the page wait on them sequentially.
    await Promise.all(charts);
}

renderDashboard();
