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

## Branding
- [ ] Does the OCF logo show in the header?
- [ ] Does the OCF logo link to the OCF website?
- [ ] Does the Documentation link (profile dropdown) go to the OCF Energy docs?
- [ ] Is there no "Quartz" / "Quartz Solar" text anywhere in the UI?


## Countries
- [ ] Does a user see only the countries their account is assigned to(admin account will see 2-3 and trial/test acc will see one ie uk)?
- [ ] Does the country switch in the header change which country the chart and times read?
- [ ] Does clicking a region in another country switch the focus to that country?
- [ ] (OCF admin only) Do the country on/off switches show under Map settings, and are they hidden for regular users?
- [ ] Does the (i) button explain how to read the data for the focused country (period start/end, data source)?


## PV Forecast

### National & Regional Charts (both charts wherever relevant)
- [ ] Clicking on a region makes the regional chart show up?
- [ ] Clicking on a region when already selected, makes the regional chart go away?
- [ ] Does the data look like solar profiles?
- [ ] GB: Does PV Live estimate show on the plot? (dashed black)
- [ ] GB: Does PV Live updated show on the plot? (solid black)
- [ ] Other countries: does the country's actual generation show on the plot? (black)
- [ ] Does the Current forecast show up on plot? (yellow)
- [ ] GB: Does the seasonal mean show up on the plot when toggled on? (light pink line)
- [ ] GB: Do the seasonal bounds show up on the plot when toggled on? (light pink shading)
- [ ] For OCF forecasts, is the future a dashed line?
- [ ] Can I hover on the plot to show the values on the plot?
- [ ] Can I click on a past time in the plot which then updates the map?
- [ ] Can I click on a future time in the plot which then updates the map?
- [ ] Is the regional chart title the correct region name (proper capitalisation, right country)?

#### Chart layout
- [ ] Does the chart float over the map at the top left?
- [ ] Can I resize the chart by dragging its right and bottom edges?
- [ ] Do Forecast and Delta each remember their own chart size after a refresh?
- [ ] Does the chart avoid covering the map controls panel?

#### Headers (National & Regional charts)
- [ ] Does the country name / region name show up in the header?
- [ ] Is the current actual generation visible?
- [ ] Is the next forecast figure visible?
- [ ] Are the above figures in GW (National) / MW (Regional) respectively?
- [ ] Are long titles truncated on small screens instead of overflowing?

#### Time (National & Regional charts)
- [ ] Is time now in the focused country's local time (Europe/London for GB, etc.)?
- [ ] Is the hover time in the focused country's local time?
- [ ] Is the X axis in the focused country's local time (and not in another language)?
- [ ] Does the data show yesterday, today, and tomorrow?
- [ ] GB steps in 30 min, 15-minute countries step in 15 min?

#### Probabilistic (National & Regional charts)
- [ ] Shading appears around the lines.
- [ ] P-level values in the tooltip are 0.0 or above.
- [ ] Probabilistic range shading and tooltip values appear on the Delta charts.

### Map
- [ ] Does the map show the assigned countries, framed in the space beside the chart?
- [ ] Are the region boundaries displayed (GSPs for GB, and the other countries' own regions)?
- [ ] Can I click on '%', 'MW' and 'Capacity' to show different map shading?
- [ ] Does the legend under the unit switch match the colours on the map, for each country's MW bands?
- [ ] Are values "higher" on the map in the middle of the day, compared to early morning?
- [ ] On 'Capacity' view, is there very little coloured shading in Scotland, and Melksham a shining beacon of renewables?
- [ ] GB: Can I switch Granularity between GSP and DNO and see the regions change on the map?
- [ ] GB: If I select a DNO, does the aggregated chart show for that DNO?
- [ ] GB: If I have a DNO selected, and switch back to GSP, does it deselect the DNO?
- [ ] GB: If I have a GSP selected, and switch to DNO, does it deselect the GSP?
- [ ] Can I Shift+click several regions and see the combined chart?
- [ ] If I move the map does a reset icon appear on top of the zoom icons?
- [ ] If I click the reset icon does it zoom back to the default view and disappear?
- [ ] Does the map popup show the region's proper name (not the raw lowercase name)?
- [ ] On a browser without WebGL support, does a friendly "Map Unavailable" message show instead of an error?

### Map Settings
- [ ] Is the Map settings drawer closed by default?
- [ ] GB: Does the Constraint boundaries toggle draw the constraint lines on the map?
- [ ] Does the Constraint boundaries setting persist across refreshes?

### Cloud Layer
- [ ] Does a `Clouds` toggle show in the map panel, in both Forecast and Delta?
- [ ] Clicking `Clouds` shows the satellite imagery layer on the map?
- [ ] Clicking `Clouds` again hides the satellite imagery layer?
- [ ] When `Clouds` is enabled, does a channel dropdown appear with `Composites` and `Individual bands` groups?
- [ ] Does a loading spinner show on the `Clouds` button while satellite imagery is fetching?
- [ ] Does the `PV` toggle hide/show the forecast shading on the map?
- [ ] Turning `Clouds` off automatically re-enables the `PV` overlay?
- [ ] Is scrubbing and playing through time with `Clouds` on smooth, without a loading spinner or flicker on each frame?
- [ ] If satellite imagery isn't available for the selected time (e.g. future timestep), does a friendly "unavailable" message show in place of the dropdown?


## Delta

### Switching
- [ ] Does selecting `Delta` under "Map shows" switch the map and chart to delta without the map flashing/reloading?
- [ ] Is `Capacity` greyed out in Delta, with a tooltip saying why?
- [ ] Does Delta open on a time where a delta exists, rather than at a time with nothing to compare?

### National & Regional Charts (both charts wherever relevant)
- [ ] Clicking on a region makes the regional chart show up?
- [ ] Clicking on a region when already selected, makes the regional chart go away?
- [ ] Does the data look like solar profiles?
- [ ] Does the actual generation show on the plot? (GB: dashed and solid black)
- [ ] Does the Current forecast show up on plot? (yellow)
- [ ] For OCF forecasts, is the future a dashed line?
- [ ] Can I hover on the plot to show the values on the plot?
- [ ] Does the delta value show up on the chart tooltip on hover?
- [ ] Do the delta bars show on the right-hand axis (orange over, light purple under)?
- [ ] Can I click on a past time in the plot which then updates the map?
- [ ] Can I click on a future time in the plot which then updates the map?

#### Headers (National & Regional charts)
- [ ] Does the country name / region name show up in the header?
- [ ] Is the "current" actual generation visible?
- [ ] Is the "current" forecast value visible?
- [ ] Is the "next" forecast value visible?
- [ ] Are the above figures in GW (National) / MW (Regional) respectively?

#### Probabilistic (National & Regional charts)
- [ ] Shading appears around the lines.
- [ ] P-level values in the tooltip are 0.0 or above.

### Map
- [ ] Are the region boundaries displayed?
- [ ] Where Deltas are available, do the correct colours for the delta buckets display and match the table?
- [ ] GB: Does Granularity (DNO) work in Delta too?
- [ ] Do Clouds work over the delta map?

### Delta Region Table
- [ ] Does the table appear and populate when Delta values are available, for each country?
- [ ] Does clicking a region in the table select the region on the map?


## Display Panel
- [ ] Does the display panel open from the tab below the map controls panel?
- [ ] Does clicking a legend item on the chart open the panel?
- [ ] Opening the panel doesn't resize or move the chart?

### Series
- [ ] Can I toggle each forecast line and actual generation line on and off?
- [ ] GB: Are ECMWF-only, Met Office-only and Satellite-only offered, and do they draw in the right colours?

### Confidence (P-levels)
- [ ] Are only the P-level pairs the country actually has offered (GB: P2/P98, P10/P90, P25/P75)?
- [ ] Toggling a P-level pair on adds its shading to the charts?
- [ ] Toggling a P-level pair off removes its shading from the charts?
- [ ] Does the chart tooltip only show values for the currently-enabled P-level pairs?
- [ ] Does the P-level selection persist across refreshes/logouts using cookie?
- [ ] Does the CSV export only include columns for the currently-selected P-levels?

### Seasonal (GB)
- [ ] Do the Seasonal mean and Seasonal quantiles toggles add/remove them from the chart?


## N Hour View

- [ ] Does the "N-hour forecast" toggle show in the Profile Dropdown menu?
- Profile Dropdown –> Toggle on
  - [ ] Does the N-hour picker show in the display panel?
  - [ ] Does the Nhr forecast show up on the plot? (orange)
  - [ ] Does the Nhr future forecast show up on the plot? (dashed orange)
  - [ ] Do the Nhr forecast values show in the hover tooltip?
  - [ ] Does changing N (1/2/4/8) update the line?
  - [ ] Does the Nhr forecast _not_ show on the charts or tooltips when its series is switched off?
- Profile Dropdown -> Toggle off
  - [ ] Does the Nhr forecast _not_ show on the legend, charts or tooltips when switched off?
  - [ ] Does the Nhr picker _not_ show when toggled off?
- [ ] Does the Nhr forecast toggle persist across refreshes/logouts using cookie?


## Time Footer
- [ ] Does the footer show the selected day, time and country, in that country's local time?
- [ ] Does it show whether I'm following live?
- [ ] Can I drag the scrub handle, and does it follow the pointer?
- [ ] Do the left/right arrow keys step one period on the focused country's grid?
- [ ] Does Play step through time in a loop, and does dragging or arrow keys stop playback?
- [ ] Does "Return to live" jump back to now and keep following it?
- [ ] Is "Now" marked on the track?
- [ ] After 10 mins on live, does the forecast update?


## Combined views
- [ ] Does **selected region** persist when switching between `Forecast` and `Delta`?
- [ ] Does **selected time** persist when switching between `Forecast` and `Delta`?
- [ ] Does **map location/zoom** persist when switching between `Forecast` and `Delta`?
- [ ] Does switching the focused country not wipe a selection I just made in that country?


## Dashboard Mode

- [ ] Does the `Dashboard mode` toggle show in the Profile Dropdown menu (top right)?
- [ ] Does the `Dashboard mode` toggle persist across refreshes/logouts using cookie?
- [ ] Is the display panel hidden in Dashboard mode?

### National & Regional
- [ ] Do the titles and forecast values show in large font?
- [ ] Are the lines on the chart thicker?

### Map
- [ ] Is the map legend larger?
- [ ] Are the MW/%/Capacity buttons larger?
- [ ] Are the date/time larger?


## Sites (`/sites`)
- [ ] Does `/sites` load for a Sites user?
- [ ] Does a non-Sites user see no sites/forecasts?
- [ ] Does the Auto / Sites aggregation work when zooming the map?
- [ ] Does the sites chart show the correct times (no timezone drift)?


## CSV Download
- [ ] Does `Download CSV...` show in the Profile Dropdown (when allowed)?
- [ ] Does the download include the focused country's data, with times in that country's local time?
- [ ] Is the button disabled until data has loaded?


## General
- [ ] Is the version visible in the Profile Dropdown (top right)?
- [ ] Does the support email (support@ocf.energy) show and copy from the Profile Dropdown?
- [ ] Is the page free of horizontal scrolling?
- [ ] Is the database stable, check on AWS

### Auth
- [ ] Can I log on with Auth?
- [ ] Can I log out?
- [ ] Does a blocked user go to the "access denied" page?
- [ ] Does an expired-trial user go to the "trial expired" page?

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