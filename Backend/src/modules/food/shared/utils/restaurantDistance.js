/**
 * Moved to Backend/src/core/location/distance.service.js as part of
 * centralizing road-distance calculation for all three legs (user<->restaurant,
 * restaurant<->driver, driver<->user). Re-exported here so existing importers
 * keep working unchanged.
 */
export {
  enrichRestaurantsWithDistance,
  formatDistanceLabel,
  getRoadDistanceMeters,
  getRoadDistanceBatch,
} from "../../../../core/location/distance.service.js";
