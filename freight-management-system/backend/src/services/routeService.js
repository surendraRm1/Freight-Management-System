/**
 * Placeholder route optimization logic. Replace with actual routing engine.
 * @param {string} origin
 * @param {string} destination
 * @returns {{origin: string, destination: string, stops: string[], eta: string}}
 */
const optimizeRoute = (origin = 'UNKNOWN_ORIGIN', destination = 'UNKNOWN_DESTINATION') => {
  const now = Date.now();
  const eta = new Date(now + 1000 * 60 * 60 * 36).toISOString(); // +36h

  return {
    origin,
    destination,
    stops: [origin, 'Central Hub', 'Regional Hub', destination],
    eta,
    notes: 'Mock route result – integrate routing engine or API later.'
  };
};

module.exports = {
  optimizeRoute
};
