# A Five-Year Glance Inside Australia's Changing Hospital Network

FIT3179 Data Visualisation 2 project: an interactive, single-page narrative of Australian hospital activity using ten charts and geographic maps.

## Viewing the web page
Click this link to view the published github web page:
https://jung-in-mak.github.io/FIT3179-Data_Visualisation_2/data_visualisation_2.html


## Charts and specifications

The Vega-Lite chart specifications are in `specs/`. The cartogram and treemap receive prepared data from JavaScript before Vega-Lite renders them. The alluvial flow is drawn as responsive SVG in JavaScript so its proportional ribbons can follow smooth curves.

1. Hospital beds per 1,000 people by country — world choropleth
2. Hospital separations by sector — interactive line chart
3. Public separations by state — proportional symbol map
4. Separations by diagnostic group — full-width treemap
5. Total hospital separations by age and sex — population pyramid
6. Patient days by age group — 2024–25 horizontal bars
7. Patient days by sector — line chart
8. Same-day and overnight separations — 2024–25 waffle chart
9. Hospital sector to service type — weighted alluvial flow
10. Hospital locations — dot map
The maps use three geographic idioms (world choropleth, proportional symbols and a hospital point-distribution map). Hover for values; the first chart also supports selecting a sector from its legend.

## Sources and data

- AIHW, [Admitted patient care](https://www.aihw.gov.au/hospitals/topics/admitted-patient-care), [2024–25 services provided tables](https://www.aihw.gov.au/getmedia/f7ce8789-cc87-40d0-b736-700b73207108/5-admitted-patient-care-2024-25-tables-services-provided.xlsx). The project uses the activity tables for the five-year series; table 5.1 for sector/service flows; and table 5.3 for diagnostic groups.
- AIHW, `data/3-admitted-patient-care-2024-25-tables-access.xlsx`, table 3.1: separations and patient days by age group and sex, all hospitals, 2024–25. `data/separations-age-sex.csv` contains the male and female separation counts used in the population pyramid.
- AIHW, table 3.1, patient days by age group, all hospitals, 2024–25. `data/patient-days-age-2024-25.csv` contains the person totals used in the age-group patient-days chart.
- Our World in Data, [Hospital beds per 1,000 people](https://ourworldindata.org/grapher/hospital-beds-per-1000-people?time=2021&v=1&csvType=filtered&useColumnShortNames=false), 2021 filtered extract, based on WHO data via World Bank (2026), CC BY 4.0. The dataset includes original reporting years for values carried forward or back to 2021.
- Natural Earth, [Admin 0 countries, 1:110m](https://github.com/nvkelso/natural-earth-vector), used for the world choropleth geometry.
- Geoscience Australia, [National HealthDirect Health Facilities MapServer](https://services.ga.gov.au/gis/rest/services/National_HealthDirect_Health_Facilities/MapServer), hospital layer. `data/health-facilities.geojson` contains 877 hospital points; © Commonwealth of Australia 2025, CC BY 4.0.
- Australian state boundaries: [rowanhogan/australian-states](https://github.com/rowanhogan/australian-states), supplied as `data/australian-states.geojson`.

The page's charts load local GeoJSON and CSV extracts rather than the source workbooks. The map and chart data fetched by the page is approximately 1.7 MB; downloaded source workbooks in `data/` are not fetched at runtime.

## Interpretation and limitations

- Separations count completed episodes of care, not individual people. Patient days count time spent in hospital, so the two totals are not interchangeable.
- The hospital-bed choropleth uses the filtered 2021 international data; some country values use a nearby reporting year shown in tooltips. Countries without a matching observation are gray.
- The age/sex population pyramid shows all-hospital separations by the male and female categories in AIHW table 3.1. It represents completed episodes of care, not unique people or population-adjusted rates.
- The age-group patient-days chart shows actual counts for a single year (2024–25); age-specific historical totals were not available in the downloaded data, so it does not imply a trend over time.
- The proportional symbol map scales symbol area by reported public separations and places symbols at approximate area-weighted state and territory centroids. It does not show within-state activity.
- The alluvial view describes aggregate table totals; it does not link any individual's care pathway.

## Assignment context and attribution

The page states the domain, audience, purpose, data and design rationale in its “What, who, why and how” section. The project author and update date appear in the page footer. Generative AI was used to assist with code and copy editing; the author remains responsible for checking the final work and attribution.

The specification also requires a tutor-reviewed sketch and a public GitHub Pages URL in the Moodle submission. Those submission items are not replaced by this repository README.
