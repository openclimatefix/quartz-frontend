"""
Code to get the generation mix for a day

Get data from Elexon BM reports
1. FUELHH - gives generation mix
2. B1630 - solar generation
3. ROLSYSDEM - gives actual demand
4. Get ESO forecast and add to forecast
5. save file
"""
from ElexonDataPortal import api
import os
import json
import pandas as pd

# setup elexon client
client = api.Client()

# columns we need
variables_cols = [
    "ccgt",
    "oil",
    "coal",
    "nuclear",
    "wind",
    "ps",
    "npshyd",
    "ocgt",
    "biomass",
    "other",
    "intfr",
    "intirl",
    "intned",
    "intew",
    "intnem",
]


def make_generation_mix(start_date, end_date):
    # ************
    # 1. FUELHH - gives generation mix
    # ***********
    df_FUELHH = client.get_FUELHH(start_date, end_date)

    # make datetime_utc and filter
    df_FUELHH["datetime_utc"] = df_FUELHH["local_datetime"].dt.tz_convert("UTC")
    df_FUELHH = df_FUELHH[df_FUELHH["datetime_utc"] >= start_date]
    df_FUELHH = df_FUELHH[df_FUELHH["datetime_utc"] < end_date]
    # make time
    df_FUELHH["time"] = df_FUELHH["datetime_utc"].dt.time

    # keep only the columnds we need
    df_FUELHH = df_FUELHH[variables_cols + ["time"]]

    # format columnds to ints
    for col in variables_cols:
        df_FUELHH[col] = df_FUELHH[col].astype(int)

    # make forecast by adding them up?
    # TODO is this right? no Need to add solar forecast
    df_FUELHH["FORECAST"] = df_FUELHH[variables_cols].sum(axis=1)

    # rename
    rename = {
        "ccgt": "Combined Cycle Gas Turbines",
        "oil": "Oil",
        "coal": "Coal",
        "nuclear": "Nuclear",
        "wind": "Wind",
        "ps": "Pumped Storage",
        "npshyd": "Hydro",
        "ocgt": "Open Cycle Gas Turbines",
        "biomass": "Biomass",
        "other": "Other",
        "intfr": "INTFR",
        "intirl": "INTIRL",
        "intned": "INTED",
        "intew": "INTEW",
        "intnem": "INTNEM",
    }
    df_FUELHH.rename(columns=rename, inplace=True)
    df_FUELHH = df_FUELHH.set_index("time")

    # ************
    # 2. B1630 - solar generation
    # ***********
    df_B1630 = client.get_B1630(start_date, end_date)

    # format datetime
    df_B1630["datetime_utc"] = df_B1630["local_datetime"].dt.tz_convert("UTC")
    df_B1630 = df_B1630[df_B1630["datetime_utc"] >= start_date]
    df_B1630 = df_B1630[df_B1630["datetime_utc"] < end_date]
    df_B1630["time"] = df_B1630["datetime_utc"].dt.time

    # only select solar and rename
    df_B1630 = df_B1630[df_B1630["powerSystemResourceType"] == '"Solar"']
    df_B1630 = df_B1630[["time", "quantity"]]
    df_B1630.rename(columns={"quantity": "SOLAR"}, inplace=True)
    df_B1630 = df_B1630.set_index("time")

    # join together
    df_all = df_FUELHH.join(df_B1630)

    # ************
    # 3. ROLSYSDEM - gives actual demand
    # ***********
    df_ROLSYSDEM = client.get_ROLSYSDEM(start_date + " 00:00:00", end_date + " 00:00:00")

    # format time
    df_ROLSYSDEM["time"] = pd.to_datetime(df_ROLSYSDEM["publishingPeriodCommencingTime"]).dt.time
    df_ROLSYSDEM = df_ROLSYSDEM[["time", "fuelTypeGeneration"]]
    df_ROLSYSDEM = df_ROLSYSDEM.rename(columns={"fuelTypeGeneration": "DEMAND"})
    df_ROLSYSDEM = df_ROLSYSDEM.set_index("time")

    # join tgoether
    df_all = df_all.join(df_ROLSYSDEM)

    # format time to HH-MM
    df_all.index.name = ""
    df_all["time"] = df_all.index
    df_all["time"] = df_all["time"].map(lambda x: str(x)[:-3])
    df_all = df_all[["time"] + list(rename.values()) + ["SOLAR", "DEMAND", "FORECAST"]]
    df_all = df_all.fillna(0)

    # make sure data is ints
    df_all["DEMAND"] = df_all["DEMAND"].astype(int)
    df_all["SOLAR"] = df_all["SOLAR"].astype(int)

    # add solar to demand
    df_all["DEMAND"] = df_all["DEMAND"] + df_all["SOLAR"]

    # ************
    # 4. load forecast from file
    # ***********
    filename = os.path.dirname(os.path.realpath(__file__)) + f"/../{start_date}/generation-forecast.json"
    forecast_df = pd.read_json(filename)
    forecast_df['time'] = pd.to_datetime(forecast_df['time'], format='%H:%M').dt.time
    forecast_df.index = forecast_df['time']
    forecast_df['SOLAR_FORECAST'] = forecast_df['FORECAST']
    forecast_df = forecast_df[['SOLAR_FORECAST']]

    df_all = df_all.join(forecast_df)
    df_all = df_all.fillna(0)
    df_all["FORECAST"] += df_all["SOLAR_FORECAST"]
    df_all["FORECAST"] = df_all["FORECAST"].astype(int)
    df_all.drop(columns=['SOLAR_FORECAST'],inplace=True)

    # ************
    # 5. save file
    # ***********
    data_dict = df_all.to_dict(orient="records")

    filename = os.path.dirname(os.path.realpath(__file__)) + f"/../{start_date}/generation-mix.json"

    print(filename)
    with open(filename, "w") as fp:
        json.dump(data_dict, fp, indent=2)


make_generation_mix("2020-08-07", "2020-08-08")
make_generation_mix("2021-03-05", "2021-03-06")
make_generation_mix("2021-03-09", "2021-03-10")
make_generation_mix("2021-06-10", "2021-06-11")
make_generation_mix("2021-10-08", "2021-10-09")
