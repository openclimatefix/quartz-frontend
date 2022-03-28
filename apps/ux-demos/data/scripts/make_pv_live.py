from pvlive_api import PVLive
from datetime import datetime, timezone
import pandas as pd
import json

# inputs
date = '2021-06-10'
start = datetime(2021,6,10,4,tzinfo=timezone.utc)
end = datetime(2021,6,10,21,tzinfo=timezone.utc)

# get data from pv live
pv = PVLive()
all_data = []
for gsp_id in range(1,339):
    print(gsp_id)
    data = pv.between(start=start, end=end,entity_type='gsp',entity_id=gsp_id, dataframe=True)
    all_data.append(data)

all_data = pd.concat(all_data)

# format data
times = sorted(all_data['datetime_gmt'].unique())
data_dict = {}
for time in times:
    data_df_time = all_data[all_data['datetime_gmt'] == time]
    data_df_time.index = data_df_time['gsp_id']

    key = time.strftime("%Y-%m-%dT%H:%M")
    item = data_df_time['generation_mw'].round().astype(int).to_dict()

    data_dict[key] = item

# save date
with open(f'apps/ux-demos/data/{date}/pvlive.json', 'w') as fp:
    json.dump(data_dict, fp, indent=2)



