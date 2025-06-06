# Quartz Energy
### A set of forecasting products driven by the exciting modelling work in Open Climate Fix and the community

The code is as open source as we can possibly make it (safely) and is powered by various forecast APIs, which are also available as services under the same Quartz umbrella.

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-8-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Head to [quartz.solar](https://quartz.solar) to find out more or to get in touch about using our Production services.



## Solar Electricity Nowcasting UI

The `nowcasting-app` is the repository for [Open Climate Fix](https://openclimatefix.org/)'s solar electricity nowcasting project. See [this great Wired article about OCF's solar electricity forecasting work](https://www.wired.co.uk/article/solar-weather-forecasting) for a good intro to solar electricity nowcasting.

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
- [OCF's coding style](https://github.com/openclimatefix/nowcasting/blob/main/coding_style.md)
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

- [satflow](https://github.com/openclimatefix/satflow): Satellite Optical Flow with machine learning models. Predicting the next few hours of satellite imagery from the recent history of satellite imagery (and other data sources).
- [predict_pv_yield](https://github.com/openclimatefix/predict_pv_yield): Using optical flow (and the output of satflow) & machine learning to predict solar PV yield (i.e. to predict the power generated by solar electricity systems over the next few hours). An older set of experiments is in [predict_pv_yield_OLD](https://github.com/openclimatefix/predict_pv_yield_OLD), which is no longer maintained..
- [nowcasting_utils](https://github.com/openclimatefix/nowcasting_utils): Forecasting performance metrics, plotting functions, loss functions, etc.
- [nowcasting_dataloader](https://github.com/openclimatefix/nowcasting_dataloader): PyTorch dataloader for taking pre-prepared batches from `nowcasting-dataset` and getting them into our models.

### PyTorch implementations of ML models from the literature

- [MetNet](https://github.com/openclimatefix/metnet): PyTorch Implementation of Google Research's MetNet ([Sønderby et al. 2020](https://arxiv.org/abs/2003.12140)), inspired from Thomas Capelle's [metnet_pytorch](https://github.com/tcapelle/metnet_pytorch/tree/master/metnet_pytorch).
- [skillful_nowcasting](https://github.com/openclimatefix/skillful_nowcasting): Implementation of DeepMind's Skillful Nowcasting GAN ([Ravuri et al. 2021](https://arxiv.org/abs/2104.00954)) in PyTorch Lightning.
- [perceiver-pytorch](https://github.com/openclimatefix/perceiver-pytorch): Implementation of DeepMind's Perceiver ([Jaegle et al. 2021](https://arxiv.org/abs/2103.03206)) and Perceiver IO ([Jaegle et al. 2021](https://arxiv.org/abs/2107.14795)) in Pytorch. Forked from [lucidrains/perceiver-pytorch](https://github.com/lucidrains/perceiver-pytorch).

### Older code (no longer maintained)

- [solar-power-mapping-data](https://github.com/openclimatefix/solar-power-mapping-data): Code to create rich harmonised geographic data for PV installations from OpenStreetMap and other sources. Mostly by Dan Stowell, The Turing Institute, and Sheffield Solar. The code behind the 2020 paper ["A harmonised, high-coverage, open dataset of solar photovoltaic installations in the UK"](https://www.nature.com/articles/s41597-020-00739-0) by Stowell et al.
- [predict_pv_yield_OLD](https://github.com/openclimatefix/predict_pv_yield_OLD)
- [predict_pv_yield_NWP](https://github.com/openclimatefix/predict_pv_yield_nwp): Build a baseline model for predicting PV yield using NWP (numerical weather predictions), as opposed to satellite imagery. This model is intentionally very simple, so we can get an end-to-end system up and running quickly to interate on.
- [metoffice_ec2](https://github.com/openclimatefix/metoffice_ec2): Extract specific parts of the [UK Met Office's UKV and MOGREPS-UK numerical weather predictions from AWS](https://registry.opendata.aws/uk-met-office/), compress, and save to S3 as Zarr. Intended to run on AWS EC2.
- [metoffice_aws_lambda](https://github.com/openclimatefix/metoffice_aws_lambda): Simple AWS Lambda function to extract specific parts of the UK Met Office's UKV and MOGREPS-UK numerical weather predictions, compress, and save to S3 as Zarr. (We found that AWS Lambda is not a good fit for this task because we actually have to do a bit of heavy-lifting, which gets very expensive on Lambda!)

## Operational solar nowcasting

- [nowcasting_api](https://github.com/openclimatefix/nowcasting_api): API for hosting nowcasting solar predictions. Will just return 'dummy numbers' until about mid-2022!

For a complete list of all of OCF's repositories tagged with "nowcasting", see [this link](https://github.com/search?l=&o=desc&q=topic%3Anowcasting+org%3Aopenclimatefix&s=updated&type=Repositories)

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://tanner.me"><img src="https://avatars.githubusercontent.com/u/227?v=4?s=100" width="100px;" alt="Damien Tanner"/><br /><sub><b>Damien Tanner</b></sub></a><br /><a href="#projectManagement-dctanner" title="Project Management">📆</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dlinah"><img src="https://avatars.githubusercontent.com/u/24292074?v=4?s=100" width="100px;" alt="lina"/><br /><sub><b>lina</b></sub></a><br /><a href="https://github.com/openclimatefix/quartz-frontend/commits?author=dlinah" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Alaatohamy"><img src="https://avatars.githubusercontent.com/u/26000327?v=4?s=100" width="100px;" alt="AlaaTohamy"/><br /><sub><b>AlaaTohamy</b></sub></a><br /><a href="https://github.com/openclimatefix/quartz-frontend/commits?author=Alaatohamy" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/flowirtz"><img src="https://avatars.githubusercontent.com/u/6052785?v=4?s=100" width="100px;" alt="Flo"/><br /><sub><b>Flo</b></sub></a><br /><a href="https://github.com/openclimatefix/quartz-frontend/commits?author=flowirtz" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://openclimatefix.org"><img src="https://avatars.githubusercontent.com/u/38562875?v=4?s=100" width="100px;" alt="dantravers"/><br /><sub><b>dantravers</b></sub></a><br /><a href="#ideas-dantravers" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/peterdudfield"><img src="https://avatars.githubusercontent.com/u/34686298?v=4?s=100" width="100px;" alt="Peter Dudfield"/><br /><sub><b>Peter Dudfield</b></sub></a><br /><a href="https://github.com/openclimatefix/quartz-frontend/commits?author=peterdudfield" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/braddf"><img src="https://avatars.githubusercontent.com/u/41056982?v=4?s=100" width="100px;" alt="braddf"/><br /><sub><b>braddf</b></sub></a><br /><a href="https://github.com/openclimatefix/quartz-frontend/commits?author=braddf" title="Code">💻</a> <a href="#design-braddf" title="Design">🎨</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/rachel-labri-tipton"><img src="https://avatars.githubusercontent.com/u/86949265?v=4?s=100" width="100px;" alt="rachel tipton"/><br /><sub><b>rachel tipton</b></sub></a><br /><a href="https://github.com/openclimatefix/quartz-frontend/pulls?q=is%3Apr+reviewed-by%3Arachel-labri-tipton" title="Reviewed Pull Requests">👀</a> <a href="https://github.com/openclimatefix/quartz-frontend/commits?author=rachel-labri-tipton" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
