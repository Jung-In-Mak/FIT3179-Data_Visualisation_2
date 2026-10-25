# A Five-Year Glance Inside Australia's Changing Hospital Network

FIT3179 Data Visualisation 2 project: an interactive, single-page narrative of Australian hospital activity using eleven charts and geographic maps.

## Viewing the web page
Click this link to view the published github web page:
https://jung-in-mak.github.io/FIT3179-Data_Visualisation_2/data_visualisation_2.html


## Charts and specifications

The Vega-Lite and Vega specifications are in `specs/`. Spec file numbers, chart numbers on the page and chart container IDs all follow the same 01–11 order. The cartogram, treemap, waffle, alluvial flow receive prepared values from JavaScript before Vega renders them.

| # | Chart | Idiom | Spec file | Container ID |
|---|-------|-------|-----------|--------------|
| 01 | Hospital beds per 1,000 people by country | World choropleth map | `specs/01-world-beds-choropleth.vl.json` | `chart-01-world-beds` |
| 02 | Hospital separations by sector | Interactive line chart | `specs/02-separations-trend.vl.json` | `chart-02-separations-trend` |
| 03 | Public separations per 1,000 people by state | Proportional symbol map | `specs/03-state-separations.vl.json` | `chart-03-state-separations` |
| 04 | Separations by diagnostic group | Treemap | `specs/04-diagnosis-treemap.vl.json` | `chart-04-diagnosis-treemap` |
| 05 | Separations by age and sex | Population pyramid | `specs/05-age-sex.vl.json` | `chart-05-age-sex` |
| 06 | Patient days by age group, 2024–25 | Horizontal bars | `specs/06-patient-days-age.vl.json` | `chart-06-patient-days-age` |
| 07 | Patient days by sector | Line chart | `specs/07-patient-days-sector.vl.json` | `chart-07-patient-days-sector` |
| 08 | Same-day and overnight separations, 2024–25 | Waffle chart | `specs/08-same-day-overnight.vl.json` | `chart-08-same-day-overnight` |
| 09 | Hospital sector to service type | Weighted alluvial flow (Vega) | `specs/09-service-flow.vg.json` | `chart-09-service-flow` |
| 10 | Hospital locations | Dot map | `specs/10-hospital-locations.vl.json` | `chart-10-hospital-locations` |
| 11 | Separations per 1,000 by remoteness area, 2013–14 to 2023–24 | Matrix heatmap with cell labels | `specs/11-separations-remoteness.vl.json` | `chart-11-separations-remoteness` |

Charts 02, 06 and 07 use basic idioms; the other eight are advanced idioms, including three map idioms (01, 03, 10). Hover for values; the hospital-separations trend also supports selecting a sector from its legend. Each chart is titled by its card heading on the page, and the heatmap shows its values in the cells.

## Typography

Headings use Fraunces and body text and chart labels use Public Sans, both loaded from Google Fonts, with Georgia and Arial as fallbacks.

## Sources and data

- AIHW, [Admitted patient care](https://www.aihw.gov.au/hospitals/topics/admitted-patient-care), [2024–25 services provided tables](https://www.aihw.gov.au/getmedia/f7ce8789-cc87-40d0-b736-700b73207108/5-admitted-patient-care-2024-25-tables-services-provided.xlsx). The project uses the activity tables for the five-year series; table 5.1 for sector/service flows; and table 5.3 for diagnostic groups.
- AIHW, `data/3-admitted-patient-care-2024-25-tables-access.xlsx`, table 3.1: separations and patient days by age group and sex, all hospitals, 2024–25. `data/separations-age-sex.csv` contains the male and female separation counts used in the population pyramid.
- AIHW, table 3.1, patient days by age group, all hospitals, 2024–25. `data/patient-days-age-2024-25.csv` contains the totals used in the age-group patient-days chart.
- AIHW, [Rural and remote health, K13 data](https://www.aihw.gov.au/reports/rural-and-remote-health/k13-data), table S9: hospitalisations (separations) per 1,000 people by remoteness area of usual residence, 2013–14 to 2023–24. `data/separations-remoteness.csv` contains the rates used in the remoteness heatmap (chart 11).
- Australian Bureau of Statistics, [National, state and territory population, June 2025](https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/jun-2025): estimated resident population used to calculate state separation rates per 1,000 residents.
- Our World in Data, [Hospital beds per 1,000 people](https://ourworldindata.org/grapher/hospital-beds-per-1000-people?time=2021&v=1&csvType=filtered&useColumnShortNames=false), 2021 filtered extract, based on WHO data via World Bank (2026), CC BY 4.0. The dataset includes original reporting years for values carried forward or back to 2021.
- Natural Earth, [Admin 0 countries, 1:110m](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/), used for the world choropleth geometry.
- Geoscience Australia, [National HealthDirect Health Facilities MapServer](https://services.ga.gov.au/gis/rest/services/National_HealthDirect_Health_Facilities/MapServer), hospital layer. `data/health-facilities.geojson` contains 877 hospital points; © Commonwealth of Australia 2025, CC BY 4.0.
- Australian state boundaries: [rowanhogan/australian-states](https://github.com/rowanhogan/australian-states), supplied as `data/australian-states.geojson`.
- Flaticon, [Hospital icons](https://www.flaticon.com/free-icons/hospital) created by Magnific, used as the symbols in the state proportional symbol map (chart 03; `data/hospital.png`).

The page's charts load local GeoJSON and CSV extracts rather than source workbooks. The map and chart data fetched by the page is approximately 2.5 MB; downloaded source workbooks in `data/` are not fetched at runtime.

## Interpretation and limitations

- Separations count completed episodes of care, not individual people. Patient days count time spent in hospital, so the two totals are not interchangeable.
- The hospital-bed choropleth uses the filtered 2021 international data; some country values use a nearby reporting year shown in tooltips. Countries without a matching observation are gray.
- The age/sex population pyramid shows all-hospital separations by the male and female categories in AIHW table 3.1. It represents completed episodes of care, not unique people or population-adjusted rates.
- The age-group patient-days chart shows actual counts for a single year (2024–25); age-specific historical totals were not available in the downloaded data, so it does not imply a trend over time.
- The remoteness heatmap covers 2013–14 to 2023–24 and uses the patient's area of usual residence, not the hospital's location. It shows differences in use, not their causes.
- The proportional symbol map scales symbol area by public separations per 1,000 residents and places symbols at approximate area-weighted state and territory centroids. It does not show within-state activity.
- The alluvial view describes aggregate table totals; it does not link any individual's care pathway.

## Assignment context and attribution

The domain, audience, purpose, data and design rationale (the "what, who, why and how") are written up in `submission-description.md`, ready to paste into the Moodle form. The project author and update date appear in the page footer. Generative AI assisted with code, chart specifications and copy editing; the author remains responsible for checking the data, interpretations, final visualisation and attribution.

The specification also requires a tutor-reviewed sketch and a public GitHub Pages URL in the Moodle submission. Those submission items are not replaced by this repository README.