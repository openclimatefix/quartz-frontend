import { AGGREGATION_LEVELS } from "../../../constant";

export const getRingMultiplier = (aggregationLevel: AGGREGATION_LEVELS, maxCapacity: number) => {
  // Get the circle multiplier based, which will times the Expected PV value to get the radius
  // We used to use 0.3 for National, 1.5 for DNO, 5 for GSP and 10 for Sites.
  // Now we use a multiplier based on the max capacity of the the different sites/regions.
  // If a client has 100 3 KW sites. Then the National multipler will be about 0.3.

  switch (aggregationLevel) {
    case AGGREGATION_LEVELS.SITE:
      return 30 / maxCapacity;
    case AGGREGATION_LEVELS.GSP:
      return 45 / maxCapacity;
    case AGGREGATION_LEVELS.REGION:
      return 60 / maxCapacity;
    case AGGREGATION_LEVELS.NATIONAL:
      return 100 / maxCapacity;
  }
};
