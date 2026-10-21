# Hospital beds per 1,000 people - Data package

This data package contains the data that powers the chart ["Hospital beds per 1,000 people"](https://ourworldindata.org/grapher/hospital-beds-per-1000-people?time=2021&v=1&csvType=filtered&useColumnShortNames=false) on the Our World in Data website. It was downloaded on October 19, 2026.

### Active Filters

A filtered subset of the full data was downloaded. The following filters were applied:
- time: 2021

## CSV structure

Each row is an observation for an entity (usually a country or region) at a timepoint.

- "Entity" — the name of the entity, e.g. "United States".
- "Code" — our internal entity code. For most countries this is the [ISO alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code, e.g. "USA"; historical and other non-standard entities get a custom code.
- "Year" or "Day" — the timepoint. Annual data has a "Year" column holding an integer year; otherwise a "Day" column holds a date string in the form "YYYY-MM-DD".
- The final column is the data column — the time series that powers the chart. Downloaded with the "full data" option it corresponds to the time series below; with "only selected data visible in the chart" it is transformed depending on the chart type, so the correspondence may be less direct.

The data file includes an additional column suffixed with (Original Year) or (Original Day). This column appears when we use "tolerance" to display data for time points where exact data is unavailable. For example, if a country does not have data for one or more years, we use tolerance to fill the gaps using the closest available data points. These suffix columns show you which year (or day) the value really came from, allowing you to see when the data was actually measured.

## Metadata.json structure

The .metadata.json file contains metadata about the data package. The "charts" key contains information to recreate the chart, like the title, subtitle etc. The "columns" key contains information about each of the columns in the csv, like the unit, timespan covered, citation for the data etc.

## How we process data at Our World in Data

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, it is your responsibility to ensure that you adhere to the sources' license and to credit them correctly. Please note that a single time series may have more than one source - e.g. when we stitch together data from different time periods by different producers or when we calculate per capita metrics using population data from a second source.

Preparing this data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, as well as adding or adapting metadata such as the name or the description given to an indicator.
[Read about our data pipeline](https://docs.owid.io/projects/etl/).

## Detailed information about the data


### Hospital beds (per 1,000 people)
Last updated: July 27, 2026  
Next expected update: January 2027  
Date range: 1960–2023  
Unit: per 1,000 people  
Source: World Health Organization (WHO) data, via World Bank (2026) – processed by Our World in Data  

#### How to cite this data

World Health Organization (WHO) data, via World Bank (2026) – processed by Our World in Data

#### How this data is described by its producers
Hospital beds include inpatient beds available in public, private, general, and specialized hospitals and rehabilitation centers. In most cases beds for both acute and chronic care are included.

### Aggregation method:
Weighted average

### Statistical concept and methodology:
Methodology: Data were compiled from the WHO Regional offices and country sources other (e.g. ministry of health, national statistical office) and modified to standardize the unit of measure of per 10 000 population by WHO.
Statistical concept(s): Health systems - the combined arrangements of institutions and actions whose primary purpose is to promote, restore, or maintain health (World Health Organization, World Health Report 2000) - are increasingly being recognized as key to combating disease and improving the health status of populations. The World Bank's Healthy Development: Strategy for Health, Nutrition, and Population Results emphasizes the need to strengthen health systems, which are weak in many countries, in order to increase the effectiveness of programs aimed at reducing specific diseases and further reduce morbidity and mortality. To evaluate health systems, the World Health Organization (WHO) has recommended that key components - such as financing, service delivery, workforce, governance, and information - be monitored using several key indicators. The data are a subset of the key indicators. Monitoring health systems allows the effectiveness, efficiency, and equity of different health system models to be compared. Health system data also help identify weaknesses and strengths and areas that need investment, such as additional health facilities, better health information systems, or better trained human resources.



Availability and use of health services, such as hospital beds per 1,000 people, reflect both demand- and supply-side factors. In the absence of a consistent definition this is a crude indicator of the extent of physical, financial, and other barriers to health care.

### Development relevance:
Hospital beds are used to indicate the availability of inpatient services.

### Limitations and exceptions:
Depending on the source and means of monitoring, data may not be exactly comparable across countries. For more information, see the original source.


## Sources

These are the sources behind the data in this package. Each time series above names the ones it draws on in its citation.

### World Health Organization (WHO) data, via World Bank – World Development Indicators

The World Development Indicators (WDI) database, published by the World Bank, is a comprehensive collection of global development data, providing key economic, social, and environmental statistics. It includes over 1,500 indicators covering more than 200 countries and territories, with data spanning several decades. WDI serves as a vital resource for policymakers, researchers, businesses, and analysts seeking to understand global trends and make data-driven decisions. The database covers a wide range of topics, including economic growth, education, health, poverty, trade, energy, infrastructure, governance, and environmental sustainability. The indicators are sourced from reputable national and international agencies, ensuring high-quality, consistent, and comparable data. Users can access the database through interactive online tools, API services, and downloadable datasets, facilitating detailed analysis and visualization. WDI is also used for tracking progress on the Sustainable Development Goals (SDGs) and other global development initiatives. By providing accessible and reliable statistics, it helps to inform policy discussions and strategies globally. Whether for academic research, policy planning, or economic analysis, the World Development Indicators database is an essential tool for understanding and addressing global development challenges.

Producer: World Health Organization (WHO) data, via World Bank  
Published: 2026-07-15  
Retrieved on: 2026-07-27  
Retrieved from: https://data.worldbank.org/indicator/SH.MED.BEDS.ZS  
Direct download: https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip  
License: CC BY 4.0 (https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators)  

Citation: WHO data, supplemented by country data, World Health Organization (WHO). Indicator SH.MED.BEDS.ZS (https://data.worldbank.org/indicator/SH.MED.BEDS.ZS). World Development Indicators – World Bank (2026). Accessed on 2026-07-27.

    