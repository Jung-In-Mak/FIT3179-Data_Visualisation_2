# A Five-Year Glance Inside Australia's Changing Hospital Network

FIT3179 Data Visualisation 2 project: an interactive, single-page narrative of Australian hospital activity using eleven charts, including three geographic map idioms and a tile cartogram.

## Run locally or publish

The project root includes `index.html` for GitHub Pages; it opens the dashboard in `data_visualisation_2.html`. To preview locally, serve this folder over localhost in VS Code (for example, with Live Server). Do not open the dashboard as a `file://` URL: its charts load local CSV, GeoJSON and Vega-Lite JSON files with `fetch`. An internet connection is required for the Vega libraries.

## Charts and specifications

Each chart has an individually readable Vega-Lite specification in `specs/`. The cartogram, treemap, alluvial flow and facility-density grid receive their prepared data from the JavaScript before Vega-Lite renders them.

1. Hospital separations by sector — interactive line chart
2. Public separations per 1,000 residents — state choropleth
3. Public separations by state — tile cartogram
4. Mental-health separations by age and sex — butterfly chart
5. Separations by diagnostic group — treemap
6. Patient days by sector — line chart
7. Same-day and overnight separations — grouped bars
8. Hospital sector to service type — weighted alluvial flow
9. Hospital locations — dot map
10. Hospital facility concentration — grid-density map
11. Emergency and non-emergency admissions by month — heatmap

The maps use three geographic idioms (choropleth, point distribution and grid density) plus a non-geographic tile cartogram. Hover for values; the first chart also supports selecting a sector from its legend.

## Sources and data

- AIHW, [Admitted patient care](https://www.aihw.gov.au/hospitals/topics/admitted-patient-care), [2024–25 reasons for care tables](https://www.aihw.gov.au/getmedia/2bc6dca9-c618-48a3-bba3-d11e0f2e047a/4-admitted-patient-care-2024-25-tables-reasons-for-care.xlsx) and [2024–25 services provided tables](https://www.aihw.gov.au/getmedia/f7ce8789-cc87-40d0-b736-700b73207108/5-admitted-patient-care-2024-25-tables-services-provided.xlsx). The project uses the activity tables for the five-year series; table 4.5 for monthly admission urgency; table 5.1 for sector/service flows; table 5.3 for diagnostic groups; and table 5.34 for mental-health separations by age and sex.
- ABS, [National, state and territory population, June 2025](https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/jun-2025), used for state and territory population denominators.
- Geoscience Australia, [National HealthDirect Health Facilities MapServer](https://services.ga.gov.au/gis/rest/services/National_HealthDirect_Health_Facilities/MapServer), hospital layer. `data/health-facilities.geojson` contains 877 hospital points; © Commonwealth of Australia 2025, CC BY 4.0.
- Australian state boundaries: [rowanhogan/australian-states](https://github.com/rowanhogan/australian-states), supplied as `data/australian-states.geojson`.

The page's charts load local GeoJSON and CSV extracts rather than the source workbooks. The map and chart data fetched by the page is approximately 1.7 MB; downloaded source workbooks in `data/` are not fetched at runtime.

## Interpretation and limitations

- Separations count completed episodes of care, not individual people. Patient days count time spent in hospital, so the two totals are not interchangeable.
- State rates divide 2024–25 public hospital separations by ABS estimated resident population at 30 June 2025. They are crude, not age-adjusted, and do not show within-state variation.
- The age/sex butterfly chart is specifically for mental-health separations; it does not represent all hospitalisations and excludes records not reported as male or female.
- The cartogram sizes state tiles by reported public separations. It is schematic and does not show remoteness-area activity.
- The facility-density grid counts mapped hospitals in geographic cells, not service capacity, access, patient use or disease clusters. Its cells are not equal-area.
- The monthly urgency heatmap shows admissions by month, not emergency department waiting time or time-of-day. The AIHW triage waiting-time view is linked from the dashboard because the supplied downloadable tables do not contain an hourly cross-tab.
- The alluvial view describes aggregate table totals; it does not link any individual's care pathway.

## Assignment context and attribution

The page states the domain, audience, purpose, data and design rationale in its “What, who, why and how” section. The project author and update date appear in the page footer. Generative AI was used to assist with code and copy editing; the author remains responsible for checking the final work and attribution.

The specification also requires a tutor-reviewed sketch and a public GitHub Pages URL in the Moodle submission. Those submission items are not replaced by this repository README.
