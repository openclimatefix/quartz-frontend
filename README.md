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

## Machine Learning

### Main repositories for our ML experiments:

| Repo                                                                       | Description                                                                                                                                                                                                                                                                                                                              | Main Developer                                     |
|----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| [ocf_datapipes](https://github.com/openclimatefix/ocf_datapipes)                   | OCF's DataPipe based dataloader for training and inference | [Jacob Bieker](https://github.com/jacobbieker)
| [PVnet](https://github.com/openclimatefix/pvnet)                           | PV net main repo | [James Fulton](https://github.com/dfulu)
| [PVNet-summation](https://github.com/openclimatefix/PVNet-summation)       | This project is used for training a model to sum the GSP predictions of PVNet into a national estimate     | [James Fulton](https://github.com/dfulu) |                                                   |
| [pv-site-prediction](https://github.com/openclimatefix/pv-site-prediction) | ML experiments and models for SBRI project | [Zak Watts](https://github.com/zakwatts)
| [UK PV National XG](https://github.com/openclimatefix/uk-pv-national-xg)   | National GSP PV forecasting using Gradient Boosted Methods.     | [Peter Dudfield](https://github.com/peterdudfield) |                                                   |

### PyTorch implementations of ML models from the literature

| Repo                                                                         | Description  |    Main Developer      |
|------------------------------------------------------------------------------|------------------------|-------| 
| [Graph Weather](https://github.com/openclimatefix/perceiver-pytorch)         | PyTorch implementation of Ryan Keisler's 2022 "Forecasting Global Weather with Graph Neural Networks" paper (https://arxiv.org/abs/2202.07575) | [Jacob Bieker](https://github.com/jacobbieker)
| [MetNet](https://github.com/openclimatefix/metnet)                           | PyTorch Implementation of Google Research's MetNet ([Sønderby et al. 2020](https://arxiv.org/abs/2003.12140)), inspired from Thomas Capelle's [metnet_pytorch](https://github.com/tcapelle/metnet_pytorch/tree/master/metnet_pytorch). | [Jacob Bieker](https://github.com/jacobbieker) 
| [Perceiver Pytorch](https://github.com/openclimatefix/perceiver-pytorch)     | Implementation of DeepMind's Perceiver ([Jaegle et al. 2021](https://arxiv.org/abs/2103.03206)) and Perceiver IO ([Jaegle et al. 2021](https://arxiv.org/abs/2107.14795)) in Pytorch. Forked from [lucidrains/perceiver-pytorch](https://github.com/lucidrains/perceiver-pytorch) |[Jack Kelly](https://github.com/JackKelly)
| [Skillful Nowcasting](https://github.com/openclimatefix/skillful_nowcasting) | Implementation of DeepMind's Skillful Nowcasting GAN ([Ravuri et al. 2021](https://arxiv.org/abs/2104.00954)) in PyTorch Lightning. | [Jacob Bieker](https://github.com/jacobbieker)

## Operational Solar Forecasting

### General 

| Repo                                                                               | Description  |    Main Developer      |
|------------------------------------------------------------------------------------|------------------------|-------| 
| [analysis-dashboard ](https://github.com/openclimatefix/uk-analysis-dashboard )    | This is a Streamlit app for the OCF team that reports database statistics | [Rachel Tipton](https://github.com/rachel-labri-tipton)
| [Nowcasting Alerts Cron](https://github.com/openclimatefix/nowcasting_alerts_cron) | Nowcasting Alerts cron Worker | [Brad Fulford](https://github.com/braddf)
| [NWP consumer](https://github.com/openclimatefix/nwp-consumer)                     | Microservice for consuming NWP data. | [Sol Cotton](https://github.com/devsjc)
| [ocf-infrastructure](https://github.com/openclimatefix/pv-site-api)                | Infrastructure code for OCF's cloud environments                                   | [Sol Cotton](https://github.com/devsjc)
| [pv-site-datamodel](https://github.com/openclimatefix/pv-site-datamodel)           | Datamodel for PV sites | [Peter Dudfield](https://github.com/peterdudfield)
| [Satip](https://github.com/openclimatefix/satip)                                   | Satip contains the code necessary for retrieving, transforming and storing EUMETSAT data | [Sol Cotton](https://github.com/devsjc)

## UK

| Repo                                                                              | Description  |    Main Developer      |
|-----------------------------------------------------------------------------------|------------------------|-------| 
| [GSPConsumer](https://github.com/openclimatefix/gspconsumer)                      | Collect GSP solar generation data from PVLive | [Peter Dudfield](https://github.com/peterdudfield)
| [nwp-consumer](https://github.com/openclimatefix/nwp-consumer)                    | Microservice for consuming NWP data. | [Sol Cotton](https://github.com/devsjc)
| [nowcasting_datamodel](https://github.com/openclimatefix/nowcasting_datamodel)    | Datamodel for the nowcasting project | [Peter Dudfield](https://github.com/peterdudfield)
| [PVConsumer](https://github.com/openclimatefix/gspconsumer)                       | Consumer PV data from various sources | [Peter Dudfield](https://github.com/peterdudfield)
| [pvnet_app](https://github.com/openclimatefix/pvnet_app)                          | Application for running PVNet in production | [Sukhil Patel](https://github.com/Sukh-P)
| [PVoutput](https://github.com/openclimatefix/pvoutput)                            | Python code for downloading PV data from PVOutput.org | [Jack Kelly](https://github.com/JackKelly)
| [pv-site-api](https://github.com/openclimatefix/pv-site-api)                      | Site specific API for SBRI project | [Peter Dudfield](https://github.com/peterdudfield)              |
| [pv-site-production](https://github.com/openclimatefix/pv-site-production)        | Production service for PV site level forecasts | [Peter Dudfield](https://github.com/peterdudfield)
| [quartz-frontend](https://github.com/openclimatefix/quartz-frontend)              | Front End repo for the Nowcasting project. | [Brad Fulford](https://github.com/braddf)
| [uk-pv-national-gsp-api](https://github.com/openclimatefix/uk-pv-national-gsp-api) | API for hosting nowcasting solar predictions | [Peter Dudfield](https://github.com/peterdudfield)

## India

| Repo                                                                       | Description  |    Main Developer      |
|----------------------------------------------------------------------------|------------------------|-------| 
| [india-api](https://github.com/openclimatefix/india-api)                   | API India solar and wind data | [Sol Cotton](https://github.com/devsjc)
| [india-forecast-app](https://github.com/openclimatefix/india-forecast-app) | Runs wind and PV forecasts for India and saves to database | [Peter Dudfield](https://github.com/peterdudfield)
| [ruvnl-consumer-app](https://github.com/openclimatefix/ruvnl-consumer-app) | Data consumer that scrapes/saves data from the Rajasthan Urja Vikas Nigam Limited (RUVNL) website. | [Peter Dudfield](https://github.com/peterdudfield)


## Other repos

| Repo                                                                     | Description                                                                                            | Main Developer                                 |
|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|------------------------------------------------| 
| [GFS Downloader](https://github.com/openclimatefix/gfs-downloader)       | NCEP GFS 0.25 Degree Global Forecast Grids Historical Archive: https://rda.ucar.edu/datasets/ds084.1/ | [Zak Watts](https://github.com/zakwatts)
| [NWP](https://github.com/openclimatefix/nwp)                             | Tools for downloading and processing numerical weather predictions          |[Jacob Bieker](https://github.com/jacobbieker)                           
| [OCF ML Metrics](https://github.com/openclimatefix/ocf-ml-metrics)       | Collection of simple baseline models and metrics for standardized evaluation of OCF forecasting models  | [Jacob Bieker](https://github.com/jacobbieker) | 
| [OCF Blocs2](https://github.com/openclimatefix/ocf_blosc2)               | Blosc2 codec used for OCF's Zarr compression | [Jacob Bieker](https://github.com/jacobbieker) | 
| [Open-Source-Quartz-Solar-Forecast](https://github.com/openclimatefix/Open-Source-Quartz-Solar-Forecast)                             | Open Source Solar Site Level Forecast          | [Zak Watts](https://github.com/zakwatts)
| [Solar and Storage](https://github.com/openclimatefix/solar-and-storage) | Solar and Storage optimization code | [Peter Dudfield](https://github.com/peterdudfield)
| [.github](https://github.com/openclimatefix/.github)                     | Various Community Health Files | [Peter Dudfield](https://github.com/peterdudfield)


For a complete list of all of OCF's repositories tagged with "nowcasting", see [this link](https://github.com/search?l=&o=desc&q=topic%3Anowcasting+org%3Aopenclimatefix&s=updated&type=Repositories)

