# Solar Electricity Nowcasting
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-8-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

This is a "meta-repository" for [Open Climate Fix](https://openclimatefix.org/)'s solar electricity nowcasting project. See [this great Wired article about OCF's solar electricity forecasting work](https://www.wired.co.uk/article/solar-weather-forecasting) for a good intro to solar electricity nowcasting.

The plan is to enable the community to build the world's best near-term forecasting system for solar electricity generation, and then let anyone use it! :) We'll do this by using state-of-the-art machine learning and 5-minutely satellite imagery to predict the movement of clouds over the next few hours, and then use this to predict solar electricity generation.

The term "nowcasting" just means "forecasting for the next few hours using statistical techniques".

# Why is all this stuff open-source?

In OCF, we're curious to see if it's possible to rapidly mitigate climate change by:

1. Enabling thousands of people to help solve ML problems which, if solved, might help reduce CO2 emissions
2. Running small(ish) pilot projects to implement the best solution in industry
3. Enabling thousands of practitioners to use the code in their products.

# What's the likely climate impact?

It's really, really, _really_ hard to estimate climate impact of forecasting! But, as a super-rough back-of-the-envelope calculation, we estimate that better solar forecasts, if rolled out globally, could reduce CO2 emissions by about a billion tonnes between now and 2035.

# Getting involved

- [List of "good first issues"](https://github.com/search?l=&p=1&q=user%3Aopenclimatefix+label%3A%22good+first+issue%22&ref=advsearch&type=Issues&utf8=%E2%9C%93&state=open): GitHub "issues" which describe changes we'd like to make to the code.
- [OCF's coding style](https://github.com/openclimatefix/.github/blob/main/coding_style.md)
- The main tools we use include: PyTorch, PyTorch Lighting, xarray, pandas, pvlib

# Overview of OCF's nowcasting repositories

## Downloading data & getting the data in the right shape for ML experiments

- [nowcasting_dataset](https://github.com/openclimatefix/nowcasting_dataset): Pre-prepares ML training batches. Loads satellite data, numerical weather predictions, solar PV power generation timeseries, and other datasets. Outputs pre-prepared ML training batches as NetCDF files (one batch per NetCDF file).
- [Satip](https://github.com/openclimatefix/Satip): Retrieve, transform and store EUMETSAT data.
- [pvoutput](https://github.com/openclimatefix/pvoutput): Python code for downloading PV data from [PVOutput.org](https://PVOutput.org).

### Older code (no longer maintained)

- [satellite_image_processing](https://github.com/openclimatefix/satellite_image_processing)
- [eumetsat](https://github.com/openclimatefix/eumetsat): Tools for downloading and processing satellite images from EUMETSAT

## Machine Learning

### Main repositories for our experiments:

| Repo                                                                             | Description                                                                                                                                                                                                                                                                                                                              | Main Developer                                     |
|----------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| [UK PV National XG](https://github.com/openclimatefix/uk-pv-national-xg)         | National GSP PV forecasting using Gradient Boosted Methods.     | [Peter Dudfield](https://github.com/peterdudfield) |                                                   |
| [Pseudo Labeller](https://github.com/openclimatefix/pseudo-labeller)             | Pseudo Labeller for generating training labels for other PV generation forecasting                                                                                                                                                                                                                                                       | [Jacob Bieker](https://github.com/jacobbieker)     |
| [PVnet](https://github.com/openclimatefix/pvnet)                                 | PV net main repo | [James Fulton](https://github.com/dfulu)
| [PV Site Prediction](https://github.com/openclimatefix/pv-site-prediction)       | ML experiments and models for SBRI project | [Zak Watts](https://github.com/zakwatts)
| [Satflow](https://github.com/openclimatefix/satflow)                             | Satellite Optical Flow with machine learning models. Predicting the next few hours of satellite imagery from the recent history of satellite imagery (and other data sources).                                                                                                                                                           | [Jacob Bieker](https://github.com/jacobbieker)     |
| [Predict PV Yield](https://github.com/openclimatefix/predict_pv_yield)           | Using optical flow (and the output of satflow) & machine learning to predict solar PV yield (i.e. to predict the power generated by solar electricity systems over the next few hours). An older set of experiments is in [predict_pv_yield_OLD](https://github.com/openclimatefix/predict_pv_yield_OLD), which is no longer maintained. | [Jack Kelly](https://github.com/JackKelly)
| [Nowcasting Utils](https://github.com/openclimatefix/nowcasting_utils)           | Forecasting performance metrics, plotting functions, loss functions, etc.      | [Peter Dudfield](https://github.com/peterdudfield) |
| [Nowcasting Dataloader](https://github.com/openclimatefix/nowcasting_dataloader) | PyTorch dataloader for taking pre-prepared batches from `nowcasting-dataset` and getting them into our models.          | [Jacob Bieker](https://github.com/jacobbieker)     |
| [Nowcasting Dataset](https://github.com/openclimatefix/nowcasting_dataset)       | Prepare batches of data for training machine learning solar electricity nowcasting data                                                                                                                                                                                                                                                  | [Jack Kelly](https://github.com/JackKelly)         


### PyTorch implementations of ML models from the literature

| Repo                                                                         | Description  |    Main Developer      |
|------------------------------------------------------------------------------|------------------------|-------| 
| [MetNet](https://github.com/openclimatefix/metnet)                           | PyTorch Implementation of Google Research's MetNet ([Sønderby et al. 2020](https://arxiv.org/abs/2003.12140)), inspired from Thomas Capelle's [metnet_pytorch](https://github.com/tcapelle/metnet_pytorch/tree/master/metnet_pytorch). | [Jacob Bieker](https://github.com/jacobbieker) 
| [Skillful Nowcasting](https://github.com/openclimatefix/skillful_nowcasting) | Implementation of DeepMind's Skillful Nowcasting GAN ([Ravuri et al. 2021](https://arxiv.org/abs/2104.00954)) in PyTorch Lightning. | [Jacob Bieker](https://github.com/jacobbieker) 
| [Perceiver Pytorch](https://github.com/openclimatefix/perceiver-pytorch)     | Implementation of DeepMind's Perceiver ([Jaegle et al. 2021](https://arxiv.org/abs/2103.03206)) and Perceiver IO ([Jaegle et al. 2021](https://arxiv.org/abs/2107.14795)) in Pytorch. Forked from [lucidrains/perceiver-pytorch](https://github.com/lucidrains/perceiver-pytorch) |[Jack Kelly](https://github.com/JackKelly)
| [Graph Weather](https://github.com/openclimatefix/perceiver-pytorch)         | PyTorch implementation of Ryan Keisler's 2022 "Forecasting Global Weather with Graph Neural Networks" paper (https://arxiv.org/abs/2202.07575) | [Jacob Bieker](https://github.com/jacobbieker)

## Operational Solar Forecasting
| Repo                                                                               | Description  |    Main Developer      |
|------------------------------------------------------------------------------------|------------------------|-------| 
| [PVoutput](https://github.com/openclimatefix/pvoutput)                             | Python code for downloading PV data from PVOutput.org | [Jack Kelly](https://github.com/JackKelly)
| [GSP Consumer](https://github.com/openclimatefix/gspconsumer)                      | Collect GSP solar generation data from PVLive | [Peter Dudfield](https://github.com/peterdudfield)
| [PV Consumer](https://github.com/openclimatefix/gspconsumer)                       | Consumer PV data from various sources | [Peter Dudfield](https://github.com/peterdudfield)
| [MetOfficeDataHub](https://github.com/openclimatefix/metofficedatahub)             | Python wrapper around MetOffice Atmospheric Model Data REST API | [Peter Dudfield](https://github.com/peterdudfield)
| [NWP consumer](https://github.com/openclimatefix/nwp-consumer)                     | Microservice for consuming NWP data. | [Sol](https://github.com/devsjc)
| [UK PV National GSP API](https://github.com/openclimatefix/uk-pv-national-gsp-api) | API for hosting nowcasting solar predictions. Will just return 'dummy numbers' until about mid-2022! | [Peter Dudfield](https://github.com/peterdudfield)
| [Satip](https://github.com/openclimatefix/satip)                                   | Satip contains the code necessary for retrieving, transforming and storing EUMETSAT data | [Jacob Bieker](https://github.com/jacobbieker)
| [Nowcasting Forecast](https://github.com/openclimatefix/nowcasting_forecast)       | Making live forecasts for the nowcasting project                                                       | [Peter Dudfield](https://github.com/peterdudfield)
| [Nowcasting Datamodel](https://github.com/openclimatefix/nowcasting_datamodel)     | Datamodel for the nowcasting project                                                                   | [Peter Dudfield](https://github.com/peterdudfield)
| [Nowcasting Metrics](https://github.com/openclimatefix/nowcasting-metrics)         | Repo to automatically run metrics on the nowcasting forecast |  [Peter Dudfield](https://github.com/peterdudfield)
| [Nowcasting Alerts Cron](https://github.com/openclimatefix/nowcasting_alerts_cron) | Nowcasting Alerts cron Worker | [Brad Fulford](https://github.com/braddf)
| [Nowcasting](https://github.com/openclimatefix/nowcasting)                         | Front End repo for the Nowcasting project. | [Brad Fulford](https://github.com/braddf)
| [UK Analysis Dashboard ](https://github.com/openclimatefix/uk-analysis-dashboard ) | This is a Streamlit app for the OCF team that reports database statistics | [Rachel Tipton](https://github.com/rachel-labri-tipton) 
| [Nowcasting](https://github.com/openclimatefix/nowcasting)                         | Front End repo for the Nowcasting project. | [Brad Fulford](https://github.com/braddf)
| [OCF Infrastructure](https://github.com/openclimatefix/pv-site-api)                | Infrastructure code for OCF's cloud environments                                   | [Sol](https://github.com/devsjc)
| [PV Site Production](https://github.com/openclimatefix/pv-site-production)         | Production service for PV site level forecasts | [Peter Dudfield](https://github.com/peterdudfield)
| [PV Site API](https://github.com/openclimatefix/pv-site-api)                       | Site specific API for SBRI project | [Peter Dudfield](https://github.com/peterdudfield)              | 
| [PV Site Mobile](https://github.com/openclimatefix/pv-site-mobile)                 | Front End web application for site-level forecast UI | [Brad Fulford](https://github.com/braddf)
| [PV Site Datamodel](https://github.com/openclimatefix/pv-site-datamodel)           | Datamodel for PV sites | [Peter Dudfield](https://github.com/peterdudfield)
| [OCF Datapipes](https://github.com/openclimatefix/ocf_datapipes)                   | OCF's DataPipe based dataloader for training and inference | [Jacob Bieker](https://github.com/jacobbieker)
## Other repos

| Repo                                                                     | Description                                                                                            | Main Developer                                 |
|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|------------------------------------------------| 
| [NWP](https://github.com/openclimatefix/nwp)                             | Tools for downloading and processing numerical weather predictions          |[Jack Kelly](https://github.com/JackKelly)                            
| [GFS Downloader](https://github.com/openclimatefix/gfs-downloader)       | NCEP GFS 0.25 Degree Global Forecast Grids Historical Archive: https://rda.ucar.edu/datasets/ds084.1/ | [Zak Watts](https://github.com/zakwatts)
| [OCF ML Metrics](https://github.com/openclimatefix/ocf-ml-metrics)       | Collection of simple baseline models and metrics for standardized evaluation of OCF forecasting models  | [Jacob Bieker](https://github.com/jacobbieker) | 
| [OCF Blocs2](https://github.com/openclimatefix/ocf_blosc2)               | Blosc2 codec used for OCF's Zarr compression | [Jacob Bieker](https://github.com/jacobbieker) | 
| [.github](https://github.com/openclimatefix/.github)                     | Various Community Health Files | [Jacob Bieker](https://github.com/jacobbieker) 
| [Solar and Storage](https://github.com/openclimatefix/solar-and-storage) | Solar and Storage optimization code | [Peter Dudfield](https://github.com/peterdudfield)


For a complete list of all of OCF's repositories tagged with "nowcasting", see [this link](https://github.com/search?l=&o=desc&q=topic%3Anowcasting+org%3Aopenclimatefix&s=updated&type=Repositories)

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center"><a href="http://tanner.me"><img src="https://avatars.githubusercontent.com/u/227?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Damien Tanner</b></sub></a><br /><a href="#projectManagement-dctanner" title="Project Management">📆</a></td>
      <td align="center"><a href="https://github.com/dlinah"><img src="https://avatars.githubusercontent.com/u/24292074?v=4?s=100" width="100px;" alt=""/><br /><sub><b>lina</b></sub></a><br /><a href="https://github.com/openclimatefix/nowcasting/commits?author=dlinah" title="Code">💻</a></td>
      <td align="center"><a href="https://github.com/Alaatohamy"><img src="https://avatars.githubusercontent.com/u/26000327?v=4?s=100" width="100px;" alt=""/><br /><sub><b>AlaaTohamy</b></sub></a><br /><a href="https://github.com/openclimatefix/nowcasting/commits?author=Alaatohamy" title="Code">💻</a></td>
      <td align="center"><a href="https://github.com/flowirtz"><img src="https://avatars.githubusercontent.com/u/6052785?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Flo</b></sub></a><br /><a href="https://github.com/openclimatefix/nowcasting/commits?author=flowirtz" title="Code">💻</a></td>
      <td align="center"><a href="http://openclimatefix.org"><img src="https://avatars.githubusercontent.com/u/38562875?v=4?s=100" width="100px;" alt=""/><br /><sub><b>dantravers</b></sub></a><br /><a href="#ideas-dantravers" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center"><a href="https://github.com/peterdudfield"><img src="https://avatars.githubusercontent.com/u/34686298?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Peter Dudfield</b></sub></a><br /><a href="https://github.com/openclimatefix/nowcasting/commits?author=peterdudfield" title="Code">💻</a></td>
      <td align="center"><a href="https://github.com/braddf"><img src="https://avatars.githubusercontent.com/u/41056982?v=4?s=100" width="100px;" alt=""/><br /><sub><b>braddf</b></sub></a><br /><a href="https://github.com/openclimatefix/nowcasting/commits?author=braddf" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center"><a href="https://github.com/rachel-labri-tipton"><img src="https://avatars.githubusercontent.com/u/86949265?v=4?s=100" width="100px;" alt=""/><br /><sub><b>rachel tipton</b></sub></a><br /><a href="https://github.com/openclimatefix/nowcasting/pulls?q=is%3Apr+reviewed-by%3Arachel-labri-tipton" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/openclimatefix/nowcasting/commits?author=rachel-labri-tipton" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
