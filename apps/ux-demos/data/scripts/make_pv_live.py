"""
Get truth solar generation per GSP from PVlive

"""
from pvlive_api import PVLive
from datetime import datetime, timezone
import pandas as pd
import json
import os

# define function
def get_data_and_save(date):

    # inputs
    print(date)
    start = date.replace(hour=4, tzinfo=timezone.utc)
    end = date.replace(hour=21, tzinfo=timezone.utc)

    # get data from pv live, for gsp 1 to 338 (inclusive)
    pv = PVLive()
    all_data = []
    for gsp_id in range(1, 10):
        print(gsp_id)
        data = pv.between(start=start, end=end, entity_type="gsp", entity_id=gsp_id, dataframe=True)
        all_data.append(data)

    all_data = pd.concat(all_data)

    # format data
    times = sorted(all_data["datetime_gmt"].unique())
    data_dict = {}
    for time in times:
        data_df_time = all_data[all_data["datetime_gmt"] == time]
        data_df_time.index = data_df_time["gsp_id"]

        key = time.strftime("%Y-%m-%dT%H:%M")
        item = data_df_time["generation_mw"].round().astype(int).to_dict()

        data_dict[key] = item

    # save date
    date_str = date.strftime("%Y-%m-%d")
    filename = os.path.dirname(os.path.realpath(__file__)) + f"/../{date_str}/pvlive.json"
    print(filename)
    with open(filename, "w") as fp:
        json.dump(data_dict, fp, indent=2)


get_data_and_save(datetime(2020, 8, 7))
get_data_and_save(datetime(2021, 3, 5))
get_data_and_save(datetime(2021, 3, 9))
get_data_and_save(datetime(2021, 6, 10))
get_data_and_save(datetime(2021, 10, 8))
