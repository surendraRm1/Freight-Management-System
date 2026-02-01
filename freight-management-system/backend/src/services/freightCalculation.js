// TODO: Replace this placeholder with real freight calculation logic.
const calculateCost = (weight, distance, type) => {
  const normalizedWeight = Number(weight) || 0;
  const normalizedDistance = Number(distance) || 0;

  return {
    price: 100,
    currency: 'USD',
    weight: normalizedWeight,
    distance: normalizedDistance,
    type: type || 'STANDARD',
    notes: 'Mock calculation result – implement business logic to compute cost.'
  };
};

module.exports = {
  calculateCost
};
