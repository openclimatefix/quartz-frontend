# Quartz UI Release & UAT

## Overview

...

- Fixes issue #000 with PR #000

## How Has This Been Tested?

- [ ] [Development](https://dev.quartz.solar)
- [ ] [Staging](https://staging.quartz.solar) for the UAT (below)

## Screenshots

---

# UAT

## Quartz-specific points
- [ ] Does the logo look like the new Quartz logo?
- [ ] Does the logo link to the new Quartz website?
- [ ] Is the OCF logo present in the logo area?
- [ ] Does the OCF logo link to the OCF website?
- [ ] Does the Documentation link go to the new Quartz docs?


## PV Forecast

### National & GSP Charts (both charts wherever relevant)
- [ ] Clicking on a GSP makes the GSP plot show up?
- [ ] Clicking on a GSP when already selected, makes the GSP plot go away?
- [ ] Does the data look like solar profiles?
- [ ] Does PV live estimate show on the plot? (dashed black)
- [ ] Does PV live updated show on the plot? (solid black)
- [ ] Does the Current forecast show up on plot? (yellow)
- [ ] Does the seasonal mean show up on the plot? (light pink line)
- [ ] Do the seasonal bounds show up on the plot when toggled on? (light pink shading)
- [ ] For OCF forecasts, is the future a dashed line?
- [ ] Can I hover on the plot to show the values on the plot?
- [ ] Can I click on a past time in the plot which then updates the map?
- [ ] Can I click on a future time in the plot which then updates the map?

#### Headers (Nat & GSP charts)
- [ ] Does `National` / the GSP name show up in the header?
- [ ] Is the current estimated PV visible?
- [ ] Is the next forecast figure visible?
- [ ] Are the above figures in GW (National / MW (GSP) respectively?

#### Time (Nat & GSP charts)
- [ ] Is time now in Europe London time?
- [ ] Is the hover time in Europe London time?
- [ ] Are the X axis in Europe London time?
- [ ] Does the data show yesterday, today, and tomorrow?

#### Probabilistic (Nat & GSP charts)
- [ ] Shading appears around the lines.
- [ ] P-level values in the tooltip are 0.0 or above.
- [ ] Probabilistic range shading and tooltip values appear on the Delta View charts.

### Map
- [ ] Does a map of the UK show up?
- [ ] Are the GSP boundaries displayed?
- [ ] Can I click on '%', 'MW' and 'Capacity' to show different map shading?
- [ ] Are values "higher" on the map in the middle of the day, compared to early morning?
- [ ] On 'Capacity' view, is there very little coloured shading in Scotland, and Melksham a shining beacon of renewables?
- [ ] Can I click the DNO grouping button and see the regions change on the map?
- [ ] If I select a DNO, does the aggregated chart show for that DNO?
- [ ] If I have a DNO selected, and click the "GSP" map button, does it deselect the DNO?
- [ ] If I have a GSP selected, and click the "DNO" map button, does it deselect the GSP?
- [ ] If I move the map does a reset icon appears on top of zoom icons?
- [ ] If I click the reset icon does it zoom back to UK and disappear?
- [ ] On a browser without WebGL support, does a friendly "Map Unavailable" message show instead of an error?

### Cloud Layer
- [ ] Does a `Clouds` toggle button show on the map (PV Forecast view only, not on Delta View)?
- [ ] Clicking `Clouds` shows the satellite imagery layer on the map?
- [ ] Clicking `Clouds` again hides the satellite imagery layer?
- [ ] When `Clouds` is enabled, does a channel dropdown appear with `Composites` and `Individual bands` groups?
- [ ] Does a loading spinner show on the `Clouds` button while satellite imagery is fetching?
- [ ] Does a `PV` toggle button show, to show/hide the yellow PV forecast overlay on the map?
- [ ] Turning `Clouds` off automatically re-enables the `PV` overlay?
- [ ] Scrubbing between nearby timesteps with `Clouds` on feels smooth, without a fresh loading spinner each time (prefetch/caching)?
- [ ] If satellite imagery isn't available for the selected time (e.g. future timestep), does a friendly "unavailable" message show in place of the dropdown?


## Delta View

### National & GSP Charts (both charts wherever relevant)
- [ ] Clicking on a GSP makes the GSP plot show up?
- [ ] Clicking on a GSP when already selected, makes the GSP plot go away?
- [ ] Does the data look like solar profiles?
- [ ] Does PV live estimate show on the plot? (dashed black)
- [ ] Does PV live updated show on the plot? (solid black)
- [ ] Does the Current forecast show up on plot? (yellow)
- [ ] Does the seasonal mean show up on the plot? (light pink line)
- [ ] Do the seasonal bounds show up on the plot when toggled on? (light pink shading)
- [ ] For OCF forecasts, is the future a dashed line?
- [ ] Can I hover on the plot to show the values on the plot?
- [ ] Does the delta value show up on the chart tooltip on hover?
- [ ] Can I click on a past time in the plot which then updates the map?
- [ ] Can I click on a future time in the plot which then updates the map?

#### Headers (Nat & GSP charts)
- [ ] Does `National` / the GSP name show up in the header?
- [ ] Is the "current" estimated PV visible?
- [ ] Is the "current" forecast value visible?
- [ ] Is the "next" forecast value visible?
- [ ] Are the above figures in GW (National / MW (GSP) respectively?

#### Time (Nat & GSP charts)
- [ ] Is time now in Europe London time? It should be now rounded up to the next 30 min.
- [ ] Is the hover time in Europe London time?
- [ ] Are the X axis in Europe London time?
- [ ] Does the data show yesterday, today, and tomorrow?

#### Probabilistic (Nat & GSP charts)
- [ ] Shading appears around the lines.
- [ ] P-level values in the tooltip are 0.0 or above.
- [ ] Probabilistic range shading and tooltip values appear on the Delta View charts.

#### Time
- [ ] Is time now in Europe London time?
- [ ] Is the hover time in Europe London time?
- [ ] Are the X axis in Europe London time?

###  Map
- [ ] Does a map of the UK show up?
- [ ] Are the GSP boundaries displayed?
- [ ] Where Deltas are available, do the correct colours for the GSP delta buckets display and match the table?

### Delta GSP Table
- [ ] Does the table appear and populate when Delta values are available?
- [ ] Does clicking a GSP in the table select the GSP on the map?


## N Hour View

- [ ] Does the "N-hour forecast" toggle show in the Profile Dropdown menu?
- Profile Dropdown –> Toggle on
  - [ ] Does the Nhr forecast show up on the plot? (orange)
  - [ ] Does the Nhr future forecast show up on the plot? (dashed orange)
  - [ ] Do the Nhr forecast values show in the hover tooltip?
  - [ ] Does the Nhr forecast _not_ show on the charts or tooltips when legend items is switched off?
- Profile Dropdown -> Toggle off
  - [ ] Does the Nhr forecast _not_ show on the legend, charts or tooltips when switched off?
  - [ ] Does the Nhr hours switcher _not_ show when toggled off?
- [ ] Does the Nhr forecast toggle persist across refreshes/logouts using cookie?


## P-level Settings

- [ ] Does a `Settings` option show in the Profile Dropdown menu (top right)?
- [ ] Clicking `Settings` opens a Settings modal with a "P-levels" section?
- [ ] Are the P2/P98, P10/P90 and P25/P75 pairs each shown with their own toggle?
- [ ] Toggling a P-level pair on adds its shading/line to the National & GSP charts?
- [ ] Toggling a P-level pair off removes its shading/line from the charts?
- [ ] Does the chart tooltip only show values for the currently-enabled P-level pairs?
- [ ] Does the P-level selection persist across refreshes/logouts using cookie?
- [ ] Does the CSV export only include columns for the currently-selected P-levels?


## Combined views
- [ ] Does **selectedGSP** persist when switching between `PV Forecast` and `Delta` Views
- [ ] Does **selectedTime** persist when switching between `PV Forecast` and `Delta` Views
- [ ] Does **map location/zoom** persist when switching between `PV Forecast` and `Delta` Views
- [ ] If I have a DNO selected, and switch to Delta View, does it deselect?
- [ ] When DNO aggregation selected, and I switch to Delta view, can I click a GSP and see its name and data in the chart?


## Dashboard Mode

- [ ] Does the `Dashboard Mode` toggle show in the Profile Dropdown menu (top right)?
- [ ] Does the `Dashboard Mode` toggle persist across refreshes/logouts using cookie?

### National & GSP
- [ ] Do the `National` and `GSP` titles and forecast values show in large font?
- [ ] Are the lines on the chart thicker?

### Legend
- [ ] Is the legend larger?
- [ ] Do the legend items space nicely?

### Map
- [ ] Is the map legend larger?
- [ ] Are the MW/%/Capacity buttons larger?
- [ ] Are the date/time larger?


## General
- [ ] Is the version visible in the Profile Dropdown (top right)?
- [ ] Has the version been bumped?
- [ ] Does the feedback button work?
- [ ] Is the database stable, check on AWS

### Auth
- [ ] Can I log on with Auth?
- [ ] Can I log out?

### Refresh
- [ ] After 10 mins, does the forecast update?

### Documentation
- Update documentation - https://openclimatefix.notion.site/Quartz-Solar-Documentation-0d718915650e4f098470d695aa3494bf
  - [ ] Yes, done
  - [ ] No
- Do we need to email the users
  - [ ] Yes, done
  - [ ] No


## Checklist:

- [ ] My code follows [OCF's coding style guidelines](https://github.com/openclimatefix/.github/blob/main/coding_style.md)
- [ ] I have performed a self-review of my own code
- [ ] I have made any corresponding changes to the README
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have bumped the version in `package.json`