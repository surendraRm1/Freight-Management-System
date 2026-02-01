const checkRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }

  return next();
};

module.exports = {
  checkRole,
};
