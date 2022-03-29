# make a dataframe with columns, "time", "FORECAST", "GENERATION"
# and save to json
import json
from pvlive_api import PVLive
from datetime import datetime, timezone
import xarray as xr
import pandas as pd
from pathlib import Path

date = datetime(2020,8,7)
start = date.replace(hour=3,minute=30, tzinfo=timezone.utc)
end = date.replace(hour=23,minute=30, tzinfo=timezone.utc)
START_TIME = f"{date.strftime('%Y-%m-%d')} 03:30"
END_TIME = f"{date.strftime('%Y-%m-%d')} 21:30"


# get forecast
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


forecast_df = pd.DataFrame(eso_pv_forecasts_selected_df.sum(axis=1),columns=['FORECAST'])

# get truth
pv = PVLive()
truth_df = pv.between(start=start, end=end, entity_type="gsp", entity_id=0, dataframe=True)
truth_df['target_time'] = truth_df['datetime_gmt'].dt.tz_convert(None)
truth_df.rename(columns={'generation_mw':'GENERATION'},inplace=True)

all_df = truth_df.join(forecast_df, on='target_time')
all_df['time'] = all_df['target_time'].dt.strftime('%H:%M')

all_df = all_df[['time','FORECAST','GENERATION']]
all_df['FORECAST'] = all_df['FORECAST'].round().astype(int)
all_df['GENERATION'] = all_df['GENERATION'].round().astype(int)

all_df = all_df.sort_values(by='time')
data_dict = all_df.to_dict(orient='records')

# save date
filename = date.strftime('%Y-%m-%d') + '_generation-forecast.json'
print(filename)
with open(filename, "w") as fp:
    json.dump(data_dict, fp, indent=2)






