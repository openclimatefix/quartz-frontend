This script generates updated DNO boundary mappings from the latest NESO GSP boundary data.
It is specifically used to regenerate the values in dno_gsp_groupings.json.

Steps to run

1. Download the latest zip from https://www.neso.energy/data-portal/gis-boundaries-gb-grid-supply-points.
2. Extract the GeoJSON file from the zip, rename it to source.geojson, and place it in this folder.
3. Save the response from https://api-dev.quartz.solar/v0/system/GB/gsp/?UI=true as gsp_id_mapping.json in this folder.
4. Save the current dno_gsp_groupings.json file in this folder.
5. Run generate_new_dnos.sh.
6. Copy the contents of new_gsps.json into dno_gsp_groupings.json.

The script writes new_gsps.json in the same folder.
