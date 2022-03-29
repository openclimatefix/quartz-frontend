from ElexonDataPortal import api
import os
import json

# {
#     "time": "00:00",
#     "Combined Cycle Gas Turbines": 5376,
#     "Oil": 0,
#     "Coal": 0,
#     "Nuclear": 5778,
#     "Wind": 4752,
#     "Pumped Storage": 0,
#     "Hydro": 48,
#     "Open Cycle Gas Turbines": 3,
#     "Biomass": 2557,
#     "Other": 140,
#     "INTFR": 1188,
#     "INTIRL": 220,
#     "INTED": 694,
#     "INTEW": 106,
#     "INTNEM": 686,
#     "SOLAR": 0,
#     "DEMAND": 22229,
#     "FORECAST": 21548
# # },
# "DEMAND": 21781,
# "FORECAST": 21067


client = api.Client()

start_date = "2020-08-07"
end_date = "2020-08-08"

# start_date = "2021-03-05"
# end_date = "2021-03-06"
# 
# start_date = "2021-03-09"
# end_date = "2021-03-10"

# start_date = "2021-06-10"
# end_date = "2021-06-11"
# 
# start_date = "2021-10-08"
# end_date = "2021-10-09"

# fuel time
df_FUELHH_raw = client.get_FUELHH(start_date, end_date)
df_FUELHH = df_FUELHH_raw
df_FUELHH['datetime_utc'] = df_FUELHH['local_datetime'].dt.tz_convert('UTC')
df_FUELHH = df_FUELHH[df_FUELHH['datetime_utc'] >= start_date]
df_FUELHH = df_FUELHH[df_FUELHH['datetime_utc'] < end_date]
df_FUELHH["time"] = df_FUELHH["datetime_utc"].dt.time

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

df_FUELHH = df_FUELHH[
    variables_cols + ['time']
]

for col in variables_cols:
    df_FUELHH[col] = df_FUELHH[col].astype(int)

df_FUELHH['FORECAST'] = df_FUELHH[variables_cols].sum(axis=1)

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



# solar
df_B1630_raw = client.get_B1630(start_date, end_date)
df_B1630 = df_B1630_raw
df_B1630['datetime_utc'] = df_B1630['local_datetime'].dt.tz_convert('UTC')
df_B1630 = df_B1630[df_B1630['datetime_utc'] >= start_date]
df_B1630 = df_B1630[df_B1630['datetime_utc'] < end_date]
df_B1630["time"] = df_B1630["datetime_utc"].dt.time
df_B1630 = df_B1630[df_B1630['powerSystemResourceType'] == '"Solar"']
df_B1630 = df_B1630[["time","quantity"]]
df_B1630.rename(columns={"quantity":"SOLAR"}, inplace=True)
df_B1630 = df_B1630.set_index("time")

df_all = df_FUELHH.join(df_B1630)

# generation and forecast
df_ROLSYSDEM = client.get_ROLSYSDEM(start_date + " 00:00:00", end_date + " 00:00:00")
df_ROLSYSDEM["time"] = pd.to_datetime(df_ROLSYSDEM['publishingPeriodCommencingTime']).dt.time
df_ROLSYSDEM = df_ROLSYSDEM[['time','fuelTypeGeneration']]
df_ROLSYSDEM = df_ROLSYSDEM.rename(columns={'fuelTypeGeneration':'DEMAND'})
df_ROLSYSDEM = df_ROLSYSDEM.set_index('time')

df_all = df_all.join(df_ROLSYSDEM)
df_all.index.name = ''
df_all['time'] = df_all.index
df_all['time'] = df_all['time'].map(lambda x: str(x)[:-3])
df_all = df_all[['time'] + list(rename.values()) + ['SOLAR','DEMAND','FORECAST']]
df_all = df_all.fillna(0)
df_all['DEMAND'] = df_all['DEMAND'].astype(int)
df_all['SOLAR'] = df_all['SOLAR'].astype(int)

data_dict = df_all.to_dict(orient='records')


filename = start_date + '_generation-mix.json'
print(filename)
with open(filename, "w") as fp:
    json.dump(data_dict, fp, indent=2)

