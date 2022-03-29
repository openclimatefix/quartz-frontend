"""
Code to get demand generation and forecast for solar
1. Load ESO forecast
2. Load truth from PVLive
3. save to json
"""

import json
from pvlive_api import PVLive
from datetime import datetime, timezone
import xarray as xr
import pandas as pd
from pathlib import Path


def make_generation_forecast(date):
    # set up start and end dates
    start = date.replace(hour=3,minute=30, tzinfo=timezone.utc)
    end = date.replace(hour=23,minute=30, tzinfo=timezone.utc)
    START_TIME = f"{date.strftime('%Y-%m-%d')} 03:30"
    END_TIME = f"{date.strftime('%Y-%m-%d')} 21:30"

    # ******************
    # 1. Load ESO forecast
    # ******************
    # get forecast
    ESO_PV_FORECAST_PATH = Path(
        "/mnt/storage_b/data/ocf/solar_pv_nowcasting/other_organisations_pv_forecasts/National_Grid_ESO/NetCDF/ESO_GSP_PV_forecasts.nc"
    )

    # open dataset
    eso_pv_forecasts = xr.open_dataset(ESO_PV_FORECAST_PATH)

    # get slice data what we need
    eso_pv_forecasts_selected = (
        eso_pv_forecasts["ML"]
        .sel(forecast_date_time=slice(pd.Timestamp(START_TIME) - pd.Timedelta("1H"), END_TIME))
        .isel(step=slice(1, 6))
    )

    # move to pandas
    eso_pv_forecasts_selected_df = eso_pv_forecasts_selected.stack(
        target_time=("forecast_date_time", "step")
    ).T.to_pandas()

    # reset index
    eso_pv_forecasts_selected_df = eso_pv_forecasts_selected_df.reset_index()

    # make target time from ini_time + step
    eso_pv_forecasts_selected_df["target_time"] = (
        eso_pv_forecasts_selected_df["forecast_date_time"] + eso_pv_forecasts_selected_df["step"]
    )

    # sort values 
    eso_pv_forecasts_selected_df = eso_pv_forecasts_selected_df.sort_values(
        ["target_time", "forecast_date_time"]
    ).drop_duplicates(subset="target_time", keep="first")

    # keep two columns
    eso_pv_forecasts_selected_df = eso_pv_forecasts_selected_df.drop(
        columns=["forecast_date_time", "step"]
    ).set_index("target_time")

    # make national forecast
    forecast_df = pd.DataFrame(eso_pv_forecasts_selected_df.sum(axis=1),columns=['FORECAST'])

    # ******************
    # 1. Load truth from PVLive
    # ******************
    # load from PV live
    pv = PVLive()
    truth_df = pv.between(start=start, end=end, entity_type="gsp", entity_id=0, dataframe=True)
    truth_df['target_time'] = truth_df['datetime_gmt'].dt.tz_convert(None)
    truth_df.rename(columns={'generation_mw':'GENERATION'},inplace=True)

    # join together
    all_df = truth_df.join(forecast_df, on='target_time')
    all_df['time'] = all_df['target_time'].dt.strftime('%H:%M')

    # keep only 4 columnds and format to ints
    all_df = all_df[['time','FORECAST','GENERATION']]
    all_df['FORECAST'] = all_df['FORECAST'].round().astype(int)
    all_df['GENERATION'] = all_df['GENERATION'].round().astype(int)

    # sort
    all_df = all_df.sort_values(by='time')
    
    # ******************
    # 3. save to json
    # ******************
    data_dict = all_df.to_dict(orient='records')

    # make filename
    date_str = date.strftime('%Y-%m-%d')
    filename = os.path.dirname(os.path.realpath(__file__)) + f"/../{date_str}/generation-forecast.json"
    print(filename)

    # save date
    with open(filename, "w") as fp:
        json.dump(data_dict, fp, indent=2)


make_generation_forecast(datetime(2020,8,7))
make_generation_forecast(datetime(2021,3,5))
make_generation_forecast(datetime(2021,3,9))
make_generation_forecast(datetime(2021,6,10))
make_generation_forecast(datetime(2021,10,8))





