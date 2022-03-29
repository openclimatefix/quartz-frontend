# make a dataframe with columns, "time", "FORECAST", "GENERATION"
# and save to json
import json
import xarray as xr
import pandas as pd
from pathlib import Path


date="2020-08-07"
# date="2021-03-05"
# date="2021-03-09"
# date="2021-06-10"
# date="2021-10-08" # we do not have this data


print(date)
START_TIME = f"{date} 03:30"
END_TIME = f"{date} 21:30"

ESO_PV_FORECAST_PATH = Path(
    "/mnt/storage_b/data/ocf/solar_pv_nowcasting/other_organisations_pv_forecasts/National_Grid_ESO/NetCDF/ESO_GSP_PV_forecasts.nc"
)


eso_pv_forecasts = xr.open_dataset(ESO_PV_FORECAST_PATH)

eso_pv_forecasts_selected = (
    eso_pv_forecasts["ML"]
    .sel(forecast_date_time=slice(pd.Timestamp(START_TIME) - pd.Timedelta("1H"), END_TIME))
    .isel(step=slice(1, 6))
)

eso_pv_forecasts_selected_df = eso_pv_forecasts_selected.stack(
    target_time=("forecast_date_time", "step")
).T.to_pandas()

eso_pv_forecasts_selected_df = eso_pv_forecasts_selected_df.reset_index()

eso_pv_forecasts_selected_df["target_time"] = (
    eso_pv_forecasts_selected_df["forecast_date_time"] + eso_pv_forecasts_selected_df["step"]
)

eso_pv_forecasts_selected_df = eso_pv_forecasts_selected_df.sort_values(
    ["target_time", "forecast_date_time"]
).drop_duplicates(subset="target_time", keep="first")

eso_pv_forecasts_selected_df = eso_pv_forecasts_selected_df.drop(
    columns=["forecast_date_time", "step"]
).set_index("target_time")

eso_pv_forecasts_selected_df = eso_pv_forecasts_selected_df.fillna(0)
# format data
times = sorted(eso_pv_forecasts_selected_df.index.unique())
data_dict = {}
for time in times:
    data_df_time = eso_pv_forecasts_selected_df[eso_pv_forecasts_selected_df.index == time]
    key = time.strftime("%Y-%m-%dT%H:%M")
    item = data_df_time.iloc[0].round().astype(int).to_dict()
    data_dict[key] = item

# save date
# filename = os.path.dirname(os.path.realpath(__file__)) + f"/../{date_str}/pvlive.json"
filename = f"{date}_ngeso.json"
print(filename)
with open(filename, "w") as fp:
    json.dump(data_dict, fp, indent=2)
