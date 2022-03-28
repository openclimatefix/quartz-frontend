import pandas as pd
import numpy as np
import xarray as xr
from datetime import datetime, timezone
import fsspec
import io
import os
import geopandas as gpd


# load data, power data and metadata
metadata_filename = 'gs://solar-pv-nowcasting-data/PV/Passive/ocf_formatted/v0/system_metadata.csv'
filename = 'gs://solar-pv-nowcasting-data/PV/Passive/ocf_formatted/v0/passiv.netcdf'


def make_generation_passiv(date):
    start = date.replace(hour=4, tzinfo=timezone.utc)
    end = date.replace(hour=21, tzinfo=timezone.utc)

    print('Loading data')
    pv_metadata = pd.read_csv(metadata_filename, index_col="system_id")

    pv_metadata['latitude'] = pv_metadata['latitude'].round(6)
    pv_metadata['longitude'] = pv_metadata['longitude'].round(6)

    with fsspec.open(filename, mode="rb") as file:
        file_bytes = file.read()
    
    with io.BytesIO(file_bytes) as file:
        pv_power = xr.open_dataset(file, engine="h5netcdf")
        pv_power = pv_power.sel(datetime=slice(start, end))
        pv_power_df_raw = pv_power.to_dataframe()
    print('Loading data:done')
    
    print('Format data')
    # filter for one day
    pv_power_df = pv_power_df_raw.resample('30Min').mean()
    pv_power_df = pv_power_df.stack()
    pv_power_df = pv_power_df.reset_index()
    pv_power_df.index = pv_power_df['datetime']
    pv_power_df.rename(columns={'level_1': 'system_id',0:'solarGeneration'}, inplace=True)
    
    # SP
    pv_power_df['time'] = (pv_power_df['datetime'].dt.hour * 2 + pv_power_df['datetime'].dt.minute / 30 + 1).astype(int)
    
    # format metadata
    pv_metadata = pv_metadata[['latitude','longitude']]
    systems_ids = [int(col) for col in pv_power_df_raw.columns]
    
    pv_system_ids = pv_metadata.index.intersection(systems_ids)
    pv_system_ids = np.sort(pv_system_ids)
    pv_metadata = pv_metadata.loc[pv_system_ids]
    pv_metadata['system_id'] = pv_metadata.index.astype(int)
    
    pv_power_df['system_id'] = pv_power_df['system_id'].astype(int)
    pv_power_df = pv_power_df.join(pv_metadata, on='system_id',lsuffix='_l')
    
    
    gdf = gpd.GeoDataFrame(
        pv_power_df, geometry=gpd.points_from_xy(pv_power_df.longitude, pv_power_df.latitude))
    
    gdf = gdf[['time','system_id','solarGeneration','geometry']]
    print('formating data:done')
    
    print('Saving data')
    date_str = date.strftime("%Y-%m-%d")
    save_filename = os.path.dirname(os.path.realpath(__file__)) + f"/../{date_str}/generation-passiv.json"

    
    with open(save_filename, "w") as text_file:
        text_file.write(gdf.to_json(indent=2, drop_id=True))
        

make_generation_passiv(datetime(2020, 8, 7))
make_generation_passiv(datetime(2021, 3, 5))
make_generation_passiv(datetime(2021, 3, 9))
make_generation_passiv(datetime(2021, 6, 10))
make_generation_passiv(datetime(2021, 10, 8))
