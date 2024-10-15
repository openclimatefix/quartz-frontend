<img src="https://cdn.prod.website-files.com/62d92550f6774db58d441cca/6324a2038936ecda71599a8b_OCF_Logo_black_trans.png" style="background-color:white;" />

Open Climate Fix (OCF) is a non-profit company, focused on Building AI tools for a greener grid. 
Every path to net zero has the electricity grid at its heart. 
At Open Climate Fix, we're delivering cutting-edge technology for industry to accelerate the energy transition.

## How to get involved?
At OCF we are passionate that all the knowledge we produce remains open, to break down intellectual property barriers and subsequently reduce the “time to impact”. We therefore encourage external users to use our base code.

Here how you can get involved:

* Submit pull requests.
* Have a look at our [List of "good first issues"](https://github.com/search?l=&p=1&q=user%3Aopenclimatefix+label%3A%22good+first+issue%22&ref=advsearch&type=Issues&utf8=%E2%9C%93&state=open): GitHub "issues" which describe changes we'd like to make to the code. Our coding style is [here](https://github.com/openclimatefix/.github/blob/main/coding_style.md)
* Check out which [Github repository](https://github.com/openclimatefix/ocf-meta-repo) are easy to contribute to. 
* Sign up to our [newsletter](https://ocfnews.substack.com/?utm_source=substack&utm_medium=web&utm_campaign=substack_profile) and follow us on [Twitter](https://twitter.com/OpenClimateFix) and [LinkedIn](https://www.linkedin.com/company/19123036/admin/) to learn the latest about our work
* Use our datasets on [Hugging Face](https://huggingface.co/openclimatefix) or [EUMETSAT satellite data](https://console.cloud.google.com/marketplace/product/bigquery-public-data/eumetsat-seviri-rss?hl=en-GB&project=solar-pv-nowcasting) and let us know if it was useful. 
* Use our ML models on [Huggin Face](https://huggingface.co/openclimatefix) and let us know if it was useful.
* Spread the word with your networks
* Use our code(!) by following the guidelines below.

## What if you use our code?
<details><summary><a>Click here to see more </a></summary>

In order for us to understand the use of our models, and to demonstrate impact to future funders, it is invaluable for us to know who is using the code and if possible, how. We licence the code in this repository under a permissive MIT licence and if you are using the code or deriving from it, we request that you attribute the use of Open Climate Fix’s work in your product by adding the text below:

#### 'original code by [Open Climate Fix](https://github.com/openclimatefix)'

If you're a contributor, we'd love for you to share your work! We ask our community to refer to themselves as an Open Climate Fix Community Contributor, specifically across social media channels and on personal CVs or portfolios. 

</details>

## How easy is it to get involved
We've set up this traffic light legend, so you can see how easy it is to get involved in each of our repositories.


| Level | Details|        
|--- | ---- |
|[![ease of contribution: easy](https://img.shields.io/badge/ease%20of%20contribution:%20easy-32bd50)](https://github.com/openclimatefix/ocf-meta-repo?tab=readme-ov-file#how-easy-is-it-to-get-involved) | These projects are easy to run, standalone, and have easily readable code. There should be issues for everyone at different skill levels.                         |
| [![ease of contribution: medium](https://img.shields.io/badge/ease%20of%20contribution:%20medium-f4900c)](https://github.com/openclimatefix/ocf-meta-repo?tab=readme-ov-file#how-easy-is-it-to-get-involved)  | These projects are accessible to contributors but might depend on your skill level. They might depend on another bit of code or need you to investigate a little bit. 
| [![ease of contribution: hard](https://img.shields.io/badge/ease%20of%20contribution:%20hard-bb2629)](https://github.com/openclimatefix/ocf-meta-repo?tab=readme-ov-file#how-easy-is-it-to-get-involved) | We would not recommend going into these projects. They haven't been made "nice" and it might take a lot of digging in the code to understand what's going on.      |

You will usually see one of the corresponding badges on the repo's README.


## Overview of OCF's repositories

Click on the sections below to see the repo's. 

<details><summary><a>Open Source Tools</a></summary>

| Repo                                                                                                     | Description                           | Main Developer                                     | Easy to contribute ? | 
|----------------------------------------------------------------------------------------------------------|---------------------------------------|----------------------------------------------------| --- |
| [Open-Source-Quartz-Solar-Forecast](https://github.com/openclimatefix/Open-Source-Quartz-Solar-Forecast) | Open Source Solar Site Level Forecast | [Zak Watts](https://github.com/zakwatts)           | 🟢
| [NWP consumer](https://github.com/openclimatefix/nwp-consumer)                                           | Microservice for consuming NWP data.  | [Sol Cotton](https://github.com/devsjc)            | 🟢
| [Elexonpy](https://github.com/openclimatefix/elexonpy)                                                   | Python wrapper for UK Elexon data     | [Peter Dudfield](https://github.com/peterdudfield) | 🟢


</details>

<details><summary><a>Machine Learning</a></summary>

### Main repositories for our ML experiments

| Repo                                                                       | Description                                                                                                                                                                                                                                                                                                                              | Main Developer                                     | Easy to contribute? | 
|----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------|---------------------| 
| [ocf-data-sampler](https://github.com/openclimatefix/ocf-data-sampler)                   | Library for creating samples suitable for ML from weather and power datasets | [James Fulton](https://github.com/dfulu) | 🟢              
| [PVnet](https://github.com/openclimatefix/pvnet)                           | PV net main repo | [James Fulton](https://github.com/dfulu) | 🔴
| [PVNet-summation](https://github.com/openclimatefix/PVNet-summation)       | This project is used for training a model to sum the GSP predictions of PVNet into a national estimate     | [James Fulton](https://github.com/dfulu) | 🔴                 |
| [pv-site-prediction](https://github.com/openclimatefix/pv-site-prediction) | ML experiments and models for SBRI project | [Zak Watts](https://github.com/zakwatts) | 🔴                 
| [UK PV National XG](https://github.com/openclimatefix/uk-pv-national-xg)   | National GSP PV forecasting using Gradient Boosted Methods.     | [Peter Dudfield](https://github.com/peterdudfield) | 🔴                 |

### PyTorch implementations of ML models from the literature

| Repo                                                                         | Description  |    Main Developer      | Easy to contribute ? | 
|------------------------------------------------------------------------------|------------------------|-------| --- |
| [Graph Weather](https://github.com/openclimatefix/graph_weather)         | PyTorch implementation of Ryan Keisler's 2022 "Forecasting Global Weather with Graph Neural Networks" paper (https://arxiv.org/abs/2202.07575) | [Jacob Bieker](https://github.com/jacobbieker) | 🟢 
| [MetNet](https://github.com/openclimatefix/metnet)                           | PyTorch Implementation of Google Research's MetNet ([Sønderby et al. 2020](https://arxiv.org/abs/2003.12140)), inspired from Thomas Capelle's [metnet_pytorch](https://github.com/tcapelle/metnet_pytorch/tree/master/metnet_pytorch). | [Jacob Bieker](https://github.com/jacobbieker) | 🟢 
| [Skillful Nowcasting](https://github.com/openclimatefix/skillful_nowcasting) | Implementation of DeepMind's Skillful Nowcasting GAN ([Ravuri et al. 2021](https://arxiv.org/abs/2104.00954)) in PyTorch Lightning. | [Jacob Bieker](https://github.com/jacobbieker) | 🟠
| [Perceiver Pytorch](https://github.com/openclimatefix/perceiver-pytorch)     | Implementation of DeepMind's Perceiver ([Jaegle et al. 2021](https://arxiv.org/abs/2103.03206)) and Perceiver IO ([Jaegle et al. 2021](https://arxiv.org/abs/2107.14795)) in Pytorch. Forked from [lucidrains/perceiver-pytorch](https://github.com/lucidrains/perceiver-pytorch) |[Jack Kelly](https://github.com/JackKelly) | 🔴

</details>

<details><summary><a>Operational Solar Forecasting</a></summary>

### General 

| Repo                                                                               | Description  |    Main Developer      | Easy to contribute ? | 
|------------------------------------------------------------------------------------|------------------------|-------| --- |
| [pv-site-datamodel](https://github.com/openclimatefix/pv-site-datamodel)           | Datamodel for PV sites | [Peter Dudfield](https://github.com/peterdudfield) | 🟢
| [ocf-infrastructure](https://github.com/openclimatefix/ocf-infrastructure)                | Infrastructure code for OCF's cloud environments  | [Sol Cotton](https://github.com/devsjc) | 🟠
| [Satip](https://github.com/openclimatefix/satip)                                   | Satip contains the code necessary for retrieving, transforming and storing EUMETSAT data | [Sol Cotton](https://github.com/devsjc) | 🟠
| [analysis-dashboard ](https://github.com/openclimatefix/uk-analysis-dashboard )    | This is a Streamlit app for the OCF team that reports database statistics | [Peter Dudfield](https://github.com/peterdudfield) | 🔴 
| [Nowcasting Alerts Cron](https://github.com/openclimatefix/nowcasting_alerts_cron) | Nowcasting Alerts cron Worker | [Brad Fulford](https://github.com/braddf) | 🔴

## UK

| Repo                                                                              | Description  |    Main Developer      | Easy to contribute ? | 
|-----------------------------------------------------------------------------------|------------------------|-------|  --- |
| [nowcasting_datamodel](https://github.com/openclimatefix/nowcasting_datamodel)    | Datamodel for the nowcasting project | [Peter Dudfield](https://github.com/peterdudfield) | 🟢
| [GSPConsumer](https://github.com/openclimatefix/gspconsumer)                      | Collect GSP solar generation data from PVLive | [Peter Dudfield](https://github.com/peterdudfield) | 🟠
| [PVConsumer](https://github.com/openclimatefix/PVConsumer)                       | Consumer PV data from various sources | [Peter Dudfield](https://github.com/peterdudfield) | 🟠
| [PVoutput](https://github.com/openclimatefix/pvoutput)                            | Python code for downloading PV data from PVOutput.org | [Jack Kelly](https://github.com/JackKelly) | 🟠
| [pv-site-api](https://github.com/openclimatefix/pv-site-api)                      | Site specific API for SBRI project | [Peter Dudfield](https://github.com/peterdudfield)              | 🟠
| [quartz-frontend](https://github.com/openclimatefix/quartz-frontend)              | Front End repo for the Nowcasting project. | [Brad Fulford](https://github.com/braddf) | 🟠
| [uk-pv-national-gsp-api](https://github.com/openclimatefix/uk-pv-national-gsp-api) | API for hosting nowcasting solar predictions | [Peter Dudfield](https://github.com/peterdudfield) | 🟠
| [pvnet_app](https://github.com/openclimatefix/pvnet_app)                          | Application for running PVNet in production | [Sukhil Patel](https://github.com/Sukh-P) | 🔴
| [pv-site-production](https://github.com/openclimatefix/pv-site-production)        | Production service for PV site level forecasts | [Peter Dudfield](https://github.com/peterdudfield) | 🔴
| [uk-pv-forecast-blend](https://github.com/openclimatefix/uk-pv-forecast-blend) | Service to blend forecast together | [Peter Dudfield](https://github.com/peterdudfield) | 🔴 

## India

| Repo                                                                       | Description  |    Main Developer      | Easy to contribute ? | 
|----------------------------------------------------------------------------|------------------------|-------| --- |
| [india-api](https://github.com/openclimatefix/india-api)                   | API India solar and wind data | [Sol Cotton](https://github.com/devsjc) | 🟢
| [india-forecast-app](https://github.com/openclimatefix/india-forecast-app) | Runs wind and PV forecasts for India and saves to database | [Peter Dudfield](https://github.com/peterdudfield) | 🔴

</details>

<details><summary><a>Other repos</a></summary>

| Repo                                                                     | Description                                                                                            | Main Developer                                 | Easy to contribute ? | 
|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|------------------------------------------------| --- |
| [GFS Downloader](https://github.com/openclimatefix/gfs-downloader)       | NCEP GFS 0.25 Degree Global Forecast Grids Historical Archive: https://rda.ucar.edu/datasets/ds084.1/ | [Zak Watts](https://github.com/zakwatts) | 🟢
| [OCF Blocs2](https://github.com/openclimatefix/ocf_blosc2)               | Blosc2 codec used for OCF's Zarr compression | [Peter Dudfield](https://github.com/peterdudfield) | 🟢
| [Solar and Storage](https://github.com/openclimatefix/solar-and-storage) | Solar and Storage optimization code | [Peter Dudfield](https://github.com/peterdudfield) | 🟢
| [.github](https://github.com/openclimatefix/.github)                     | Various Community Health Files | [Peter Dudfield](https://github.com/peterdudfield) | 🔴


For a complete list of all of OCF's repositories tagged with "nowcasting", see [this link](https://github.com/search?l=&o=desc&q=topic%3Anowcasting+org%3Aopenclimatefix&s=updated&type=Repositories)

</details>

