/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export type paths = {
  "/v0/solar/GB/national/forecast": {
    /**
     * Get National Forecast
     * @description Get the National Forecast
     *
     * This route returns the most recent forecast for each _target_time_.
     *
     * The _forecast_horizon_minutes_ parameter allows
     * a user to query for a forecast that is made this number, or horizon, of
     * minutes before the _target_time_.
     *
     * For example, if the target time is 10am today, the forecast made at 2am
     * today is the 8-hour forecast for 10am, and the forecast made at 6am for
     * 10am today is the 4-hour forecast for 10am.
     *
     * #### Parameters
     * - **forecast_horizon_minutes**: optional forecast horizon in minutes (ex.
     * 60 returns the forecast made an hour before the target time)
     */
    get: operations["get_national_forecast_v0_solar_GB_national_forecast_get"];
  };
  "/v0/solar/GB/national/pvlive": {
    /**
     * Get National Pvlive
     * @description ### Get national PV_Live values for yesterday and/or today
     *
     * Returns a series of real-time solar energy generation readings from
     * PV_Live for all of Great Britain.
     *
     * _In-day_ values are PV generation estimates for the current day,
     * while _day-after_ values are
     * updated PV generation truths for the previous day along with
     * _in-day_ estimates for the current day.
     *
     * If nothing is set for the _regime_ parameter, the route will return
     * _in-day_ values for the current day.
     *
     * #### Parameters
     * - **regime**: can choose __in-day__ or __day-after__
     */
    get: operations["get_national_pvlive_v0_solar_GB_national_pvlive_get"];
  };
  "/v0/solar/GB/gsp/forecast/all/": {
    /**
     * Get All Available Forecasts
     * @description ### Get all forecasts for all GSPs
     *
     * The return object contains a forecast object with system details and
     * forecast values for all GSPs.
     *
     * This request may take a longer time to load because a lot of data is being
     * pulled from the database.
     *
     * If _compact_ is set to true, the response will be a list of GSPGenerations objects.
     * This return object is significantly smaller, but less readable.
     *
     * #### Parameters
     * - **historic**: boolean that defaults to `true`, returning yesterday's and
     * today's forecasts for all GSPs
     * - **start_datetime_utc**: optional start datetime for the query. e.g '2023-08-12 10:00:00+00:00'
     * - **end_datetime_utc**: optional end datetime for the query. e.g '2023-08-12 14:00:00+00:00'
     */
    get: operations["get_all_available_forecasts_v0_solar_GB_gsp_forecast_all__get"];
  };
  "/v0/solar/GB/gsp/{gsp_id}/forecast": {
    /**
     * Get Forecasts For A Specific Gsp
     * @description ### Get recent forecast values for a specific GSP
     *
     * This route returns the most recent forecast for each _target_time_ for a
     * specific GSP.
     *
     * The _forecast_horizon_minutes_ parameter allows
     * a user to query for a forecast that is made this number, or horizon, of
     * minutes before the _target_time_.
     *
     * For example, if the target time is 10am today, the forecast made at 2am
     * today is the 8-hour forecast for 10am, and the forecast made at 6am for
     * 10am today is the 4-hour forecast for 10am.
     *
     * #### Parameters
     * - **gsp_id**: *gsp_id* of the desired forecast
     * - **forecast_horizon_minutes**: optional forecast horizon in minutes (ex. 60
     * - **start_datetime_utc**: optional start datetime for the query.
     * - **end_datetime_utc**: optional end datetime for the query.
     * returns the latest forecast made 60 minutes before the target time)
     */
    get: operations["get_forecasts_for_a_specific_gsp_v0_solar_GB_gsp__gsp_id__forecast_get"];
  };
  "/v0/solar/GB/gsp/pvlive/all": {
    /**
     * Get Truths For All Gsps
     * @description ### Get PV_Live values for all GSPs for yesterday and today
     *
     * The return object is a series of real-time PV generation estimates or
     * truth values from __PV_Live__ for all GSPs.
     *
     * Setting the _regime_ parameter to _day-after_ includes
     * the previous day's truth values for the GSPs.
     *
     * If _regime_ is not specified, the parameter defaults to _in-day_.
     *
     * If _compact_ is set to true, the response will be a list of GSPGenerations objects.
     * This return object is significantly smaller, but less readable.
     *
     * #### Parameters
     * - **regime**: can choose __in-day__ or __day-after__
     * - **start_datetime_utc**: optional start datetime for the query.
     * - **end_datetime_utc**: optional end datetime for the query.
     */
    get: operations["get_truths_for_all_gsps_v0_solar_GB_gsp_pvlive_all_get"];
  };
  "/v0/solar/GB/gsp/{gsp_id}/pvlive": {
    /**
     * Get Truths For A Specific Gsp
     * @description ### Get PV_Live values for a specific GSP for yesterday and today
     *
     * The return object is a series of real-time solar energy generation
     * from __PV_Live__ for a single GSP.
     *
     * Setting the _regime_ parameter to _day-after_ includes
     * the previous day's truth values for the GSPs.
     *
     * If _regime_ is not specified, the parameter defaults to _in-day_.
     *
     * #### Parameters
     * - **gsp_id**: _gsp_id_ of the requested forecast
     * - **regime**: can choose __in-day__ or __day-after__
     * - **start_datetime_utc**: optional start datetime for the query.
     * - **end_datetime_utc**: optional end datetime for the query.
     * If not set, defaults to N_HISTORY_DAYS env var, which if not set defaults to yesterday.
     */
    get: operations["get_truths_for_a_specific_gsp_v0_solar_GB_gsp__gsp_id__pvlive_get"];
  };
  "/v0/solar/GB/status": {
    /**
     * Get Status
     * @description ### Get status for the database and forecasts
     *
     * Occasionally there may be a small problem or interruption with the forecast. This
     * route is where the OCF team communicates the forecast status to users.
     */
    get: operations["get_status_v0_solar_GB_status_get"];
  };
  "/v0/system/GB/gsp/boundaries": {
    /**
     * Get Gsp Boundaries
     * @description ### Get GSP boundaries
     *
     * Returns an object with GSP boundaries provided by National Grid ESO.
     *
     * [This is a wrapper around the dataset](https://data.nationalgrideso.com/systemgis-boundaries-for-gb-grid-supply-points).
     *
     * The return object is in EPSG:4326 (ie. contains latitude & longitude
     * coordinates).
     */
    get: operations["get_gsp_boundaries_v0_system_GB_gsp_boundaries_get"];
  };
  "/v0/system/GB/gsp/": {
    /**
     * Get System Details
     * @description ### Get system details for a single GSP or all GSPs
     *
     * Returns an object with system details of a given GSP using the
     * _gsp_id_ query parameter, otherwise details for all supply points are provided.
     *
     * #### Parameters
     * - **gsp_id**: gsp_id of the requested system
     */
    get: operations["get_system_details_v0_system_GB_gsp__get"];
  };
  "/": {
    /**
     * Get Api Information
     * @description ### Get basic Quartz Solar API information
     *
     * Returns a json object with basic information about the Quartz Solar API.
     */
    get: operations["get_api_information__get"];
  };
};

export type webhooks = Record<string, never>;

export type components = {
  schemas: {
    /**
     * Forecast
     * @description A single Forecast
     */
    Forecast: {
      /**
       * Location
       * @description The location object for this forecaster
       */
      location: components["schemas"]["Location"];
      /**
       * Model
       * @description The name of the model that made this forecast
       */
      model: components["schemas"]["MLModel"];
      /**
       * Forecastcreationtime
       * Format: date-time
       * @description The time when the forecaster was made
       */
      forecastCreationTime: string;
      /**
       * Historic
       * @description if False, the forecast is just the latest forecast. If True, historic values are also given
       * @default false
       */
      historic?: boolean;
      /**
       * Forecastvalues
       * @description List of forecasted value objects. Each value has the datestamp and a value
       */
      forecastValues: components["schemas"]["ForecastValue"][];
      /**
       * Inputdatalastupdated
       * @description Information about the input data that was used to create the forecast
       */
      inputDataLastUpdated: components["schemas"]["InputDataLastUpdated"];
    };
    /**
     * ForecastValue
     * @description One Forecast of generation at one timestamp
     */
    ForecastValue: {
      /**
       * Targettime
       * Format: date-time
       * @description The target time that the forecast is produced for
       */
      targetTime: string;
      /**
       * Expectedpowergenerationmegawatts
       * @description The forecasted value in MW
       */
      expectedPowerGenerationMegawatts: number;
      /**
       * Expectedpowergenerationnormalized
       * @description The forecasted value divided by the gsp capacity [%]
       */
      expectedPowerGenerationNormalized?: number;
    };
    /**
     * GSPYield
     * @description GSP Yield data
     */
    GSPYield: {
      /**
       * Datetimeutc
       * Format: date-time
       * @description The timestamp of the gsp yield
       */
      datetimeUtc: string;
      /**
       * Solargenerationkw
       * @description The amount of solar generation
       */
      solarGenerationKw: number;
    };
    /**
     * GSPYieldGroupByDatetime
     * @description gsp yields for one a singel datetime
     */
    GSPYieldGroupByDatetime: {
      /**
       * Datetimeutc
       * Format: date-time
       * @description The timestamp of the gsp yield
       */
      datetimeUtc: string;
      /**
       * Generationkwbygspid
       * @description List of generations by gsp_id. Key is gsp_id, value is generation_kw. We keep this as a dictionary to keep the size of the file small
       */
      generationKwByGspId: {
        [key: string]: string;
      };
    };
    /** HTTPValidationError */
    HTTPValidationError: {
      /** Detail */
      detail?: components["schemas"]["ValidationError"][];
    };
    /**
     * InputDataLastUpdated
     * @description Information about the input data that was used to create the forecast
     */
    InputDataLastUpdated: {
      /**
       * Gsp
       * Format: date-time
       * @description The time when the input GSP data was last updated
       */
      gsp: string;
      /**
       * Nwp
       * Format: date-time
       * @description The time when the input NWP data was last updated
       */
      nwp: string;
      /**
       * Pv
       * Format: date-time
       * @description The time when the input PV data was last updated
       */
      pv: string;
      /**
       * Satellite
       * Format: date-time
       * @description The time when the input satellite data was last updated
       */
      satellite: string;
    };
    /**
     * Location
     * @description Location that the forecast is for
     */
    Location: {
      /** Label */
      label: string;
      /**
       * Gspid
       * @description The Grid Supply Point (GSP) id
       */
      gspId?: number;
      /**
       * Gspname
       * @description The GSP name
       */
      gspName?: string;
      /**
       * Gspgroup
       * @description The GSP group name
       */
      gspGroup?: string;
      /**
       * Regionname
       * @description The GSP region name
       */
      regionName?: string;
      /**
       * Installedcapacitymw
       * @description The installed capacity of the GSP in MW
       */
      installedCapacityMw?: number;
    };
    /**
     * LocationWithGSPYields
     * @description Location object with GSPYields
     */
    LocationWithGSPYields: {
      /** Label */
      label: string;
      /**
       * Gspid
       * @description The Grid Supply Point (GSP) id
       */
      gspId?: number;
      /**
       * Gspname
       * @description The GSP name
       */
      gspName?: string;
      /**
       * Gspgroup
       * @description The GSP group name
       */
      gspGroup?: string;
      /**
       * Regionname
       * @description The GSP region name
       */
      regionName?: string;
      /**
       * Installedcapacitymw
       * @description The installed capacity of the GSP in MW
       */
      installedCapacityMw?: number;
      /**
       * Gspyields
       * @description List of gsp yields
       * @default []
       */
      gspYields?: components["schemas"]["GSPYield"][];
    };
    /**
     * MLModel
     * @description ML model that is being used
     */
    MLModel: {
      /**
       * Name
       * @description The name of the model
       */
      name: string;
      /**
       * Version
       * @description The version of the model
       */
      version: string;
    };
    /**
     * ManyForecasts
     * @description Many Forecasts
     */
    ManyForecasts: {
      /**
       * Forecasts
       * @description List of forecasts for different GSPs
       */
      forecasts: components["schemas"]["Forecast"][];
    };
    /**
     * NationalForecast
     * @description One Forecast of generation at one timestamp
     */
    NationalForecast: {
      /**
       * Location
       * @description The location object for this forecaster
       */
      location: components["schemas"]["Location"];
      /**
       * Model
       * @description The name of the model that made this forecast
       */
      model: components["schemas"]["MLModel"];
      /**
       * Forecastcreationtime
       * Format: date-time
       * @description The time when the forecaster was made
       */
      forecastCreationTime: string;
      /**
       * Historic
       * @description if False, the forecast is just the latest forecast. If True, historic values are also given
       * @default false
       */
      historic?: boolean;
      /**
       * Forecastvalues
       * @description List of forecast values
       */
      forecastValues: components["schemas"]["NationalForecastValue"][];
      /**
       * Inputdatalastupdated
       * @description Information about the input data that was used to create the forecast
       */
      inputDataLastUpdated: components["schemas"]["InputDataLastUpdated"];
    };
    /**
     * NationalForecastValue
     * @description One Forecast of generation at one timestamp include properties
     */
    NationalForecastValue: {
      /**
       * Targettime
       * Format: date-time
       * @description The target time that the forecast is produced for
       */
      targetTime: string;
      /**
       * Expectedpowergenerationmegawatts
       * @description The forecasted value in MW
       */
      expectedPowerGenerationMegawatts: number;
      /**
       * Expectedpowergenerationnormalized
       * @description The forecasted value divided by the gsp capacity [%]
       */
      expectedPowerGenerationNormalized?: number;
      /**
       * Plevels
       * @description Dictionary to hold properties of the forecast, like p_levels.
       */
      plevels?: Record<string, never>;
    };
    /**
     * OneDatetimeManyForecastValues
     * @description One datetime with many forecast values
     */
    OneDatetimeManyForecastValues: {
      /**
       * Datetimeutc
       * Format: date-time
       * @description The timestamp of the gsp yield
       */
      datetimeUtc: string;
      /**
       * Forecastvalues
       * @description List of forecasts by gsp_id. Key is gsp_id, value is generation_kw. We keep this as a dictionary to keep the size of the file small
       */
      forecastValues: {
        [key: string]: number;
      };
    };
    /**
     * Status
     * @description Status Model for a single message
     */
    Status: {
      /**
       * Status
       * @description Status description
       */
      status: string;
      /**
       * Message
       * @description Status Message
       */
      message: string;
    };
    /** ValidationError */
    ValidationError: {
      /** Location */
      loc: (string | number)[];
      /** Message */
      msg: string;
      /** Error Type */
      type: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
};

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export type operations = {
  /**
   * Get National Forecast
   * @description Get the National Forecast
   *
   * This route returns the most recent forecast for each _target_time_.
   *
   * The _forecast_horizon_minutes_ parameter allows
   * a user to query for a forecast that is made this number, or horizon, of
   * minutes before the _target_time_.
   *
   * For example, if the target time is 10am today, the forecast made at 2am
   * today is the 8-hour forecast for 10am, and the forecast made at 6am for
   * 10am today is the 4-hour forecast for 10am.
   *
   * #### Parameters
   * - **forecast_horizon_minutes**: optional forecast horizon in minutes (ex.
   * 60 returns the forecast made an hour before the target time)
   */
  get_national_forecast_v0_solar_GB_national_forecast_get: {
    parameters: {
      query?: {
        forecast_horizon_minutes?: number;
        include_metadata?: boolean;
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json":
            | components["schemas"]["NationalForecast"]
            | components["schemas"]["NationalForecastValue"][];
        };
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  /**
   * Get National Pvlive
   * @description ### Get national PV_Live values for yesterday and/or today
   *
   * Returns a series of real-time solar energy generation readings from
   * PV_Live for all of Great Britain.
   *
   * _In-day_ values are PV generation estimates for the current day,
   * while _day-after_ values are
   * updated PV generation truths for the previous day along with
   * _in-day_ estimates for the current day.
   *
   * If nothing is set for the _regime_ parameter, the route will return
   * _in-day_ values for the current day.
   *
   * #### Parameters
   * - **regime**: can choose __in-day__ or __day-after__
   */
  get_national_pvlive_v0_solar_GB_national_pvlive_get: {
    parameters: {
      query?: {
        regime?: string;
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json": components["schemas"]["GSPYield"][];
        };
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  /**
   * Get All Available Forecasts
   * @description ### Get all forecasts for all GSPs
   *
   * The return object contains a forecast object with system details and
   * forecast values for all GSPs.
   *
   * This request may take a longer time to load because a lot of data is being
   * pulled from the database.
   *
   * If _compact_ is set to true, the response will be a list of GSPGenerations objects.
   * This return object is significantly smaller, but less readable.
   *
   * #### Parameters
   * - **historic**: boolean that defaults to `true`, returning yesterday's and
   * today's forecasts for all GSPs
   * - **start_datetime_utc**: optional start datetime for the query. e.g '2023-08-12 10:00:00+00:00'
   * - **end_datetime_utc**: optional end datetime for the query. e.g '2023-08-12 14:00:00+00:00'
   */
  get_all_available_forecasts_v0_solar_GB_gsp_forecast_all__get: {
    parameters: {
      query?: {
        historic?: boolean;
        start_datetime_utc?: string;
        end_datetime_utc?: string;
        compact?: boolean;
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json":
            | components["schemas"]["ManyForecasts"]
            | components["schemas"]["OneDatetimeManyForecastValues"][];
        };
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  /**
   * Get Forecasts For A Specific Gsp
   * @description ### Get recent forecast values for a specific GSP
   *
   * This route returns the most recent forecast for each _target_time_ for a
   * specific GSP.
   *
   * The _forecast_horizon_minutes_ parameter allows
   * a user to query for a forecast that is made this number, or horizon, of
   * minutes before the _target_time_.
   *
   * For example, if the target time is 10am today, the forecast made at 2am
   * today is the 8-hour forecast for 10am, and the forecast made at 6am for
   * 10am today is the 4-hour forecast for 10am.
   *
   * #### Parameters
   * - **gsp_id**: *gsp_id* of the desired forecast
   * - **forecast_horizon_minutes**: optional forecast horizon in minutes (ex. 60
   * - **start_datetime_utc**: optional start datetime for the query.
   * - **end_datetime_utc**: optional end datetime for the query.
   * returns the latest forecast made 60 minutes before the target time)
   */
  get_forecasts_for_a_specific_gsp_v0_solar_GB_gsp__gsp_id__forecast_get: {
    parameters: {
      query?: {
        forecast_horizon_minutes?: number;
        start_datetime_utc?: string;
        end_datetime_utc?: string;
      };
      path: {
        gsp_id: number;
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json":
            | components["schemas"]["Forecast"]
            | components["schemas"]["ForecastValue"][];
        };
      };
      /** @description No Content */
      204: {
        content: never;
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  /**
   * Get Truths For All Gsps
   * @description ### Get PV_Live values for all GSPs for yesterday and today
   *
   * The return object is a series of real-time PV generation estimates or
   * truth values from __PV_Live__ for all GSPs.
   *
   * Setting the _regime_ parameter to _day-after_ includes
   * the previous day's truth values for the GSPs.
   *
   * If _regime_ is not specified, the parameter defaults to _in-day_.
   *
   * If _compact_ is set to true, the response will be a list of GSPGenerations objects.
   * This return object is significantly smaller, but less readable.
   *
   * #### Parameters
   * - **regime**: can choose __in-day__ or __day-after__
   * - **start_datetime_utc**: optional start datetime for the query.
   * - **end_datetime_utc**: optional end datetime for the query.
   */
  get_truths_for_all_gsps_v0_solar_GB_gsp_pvlive_all_get: {
    parameters: {
      query?: {
        regime?: string;
        start_datetime_utc?: string;
        end_datetime_utc?: string;
        compact?: boolean;
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json":
            | components["schemas"]["LocationWithGSPYields"][]
            | components["schemas"]["GSPYieldGroupByDatetime"][];
        };
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  /**
   * Get Truths For A Specific Gsp
   * @description ### Get PV_Live values for a specific GSP for yesterday and today
   *
   * The return object is a series of real-time solar energy generation
   * from __PV_Live__ for a single GSP.
   *
   * Setting the _regime_ parameter to _day-after_ includes
   * the previous day's truth values for the GSPs.
   *
   * If _regime_ is not specified, the parameter defaults to _in-day_.
   *
   * #### Parameters
   * - **gsp_id**: _gsp_id_ of the requested forecast
   * - **regime**: can choose __in-day__ or __day-after__
   * - **start_datetime_utc**: optional start datetime for the query.
   * - **end_datetime_utc**: optional end datetime for the query.
   * If not set, defaults to N_HISTORY_DAYS env var, which if not set defaults to yesterday.
   */
  get_truths_for_a_specific_gsp_v0_solar_GB_gsp__gsp_id__pvlive_get: {
    parameters: {
      query?: {
        regime?: string;
        start_datetime_utc?: string;
        end_datetime_utc?: string;
      };
      path: {
        gsp_id: number;
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json": components["schemas"]["GSPYield"][];
        };
      };
      /** @description No Content */
      204: {
        content: never;
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  /**
   * Get Status
   * @description ### Get status for the database and forecasts
   *
   * Occasionally there may be a small problem or interruption with the forecast. This
   * route is where the OCF team communicates the forecast status to users.
   */
  get_status_v0_solar_GB_status_get: {
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json": components["schemas"]["Status"];
        };
      };
    };
  };
  /**
   * Get Gsp Boundaries
   * @description ### Get GSP boundaries
   *
   * Returns an object with GSP boundaries provided by National Grid ESO.
   *
   * [This is a wrapper around the dataset](https://data.nationalgrideso.com/systemgis-boundaries-for-gb-grid-supply-points).
   *
   * The return object is in EPSG:4326 (ie. contains latitude & longitude
   * coordinates).
   */
  get_gsp_boundaries_v0_system_GB_gsp_boundaries_get: {
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json": Record<string, never>;
        };
      };
    };
  };
  /**
   * Get System Details
   * @description ### Get system details for a single GSP or all GSPs
   *
   * Returns an object with system details of a given GSP using the
   * _gsp_id_ query parameter, otherwise details for all supply points are provided.
   *
   * #### Parameters
   * - **gsp_id**: gsp_id of the requested system
   */
  get_system_details_v0_system_GB_gsp__get: {
    parameters: {
      query?: {
        gsp_id?: number;
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json": components["schemas"]["Location"][];
        };
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  /**
   * Get Api Information
   * @description ### Get basic Quartz Solar API information
   *
   * Returns a json object with basic information about the Quartz Solar API.
   */
  get_api_information__get: {
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json": unknown;
        };
      };
    };
  };
};
