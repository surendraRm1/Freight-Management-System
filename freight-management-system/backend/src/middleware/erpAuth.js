const erpWebhookSecret = process.env.ERP_WEBHOOK_SECRET;

/**
 * Basic shared-secret validation for ERP webhook calls.
 * Assumes the ERP posts an `x-secret-key` header that must match
 * `ERP_WEBHOOK_SECRET` defined in the backend environment.
 */
const verifyErpSecret = (req, res, next) => {
  const providedSecret = req.headers['x-secret-key'];

  if (!erpWebhookSecret) {
    return res
      .status(500)
      .json({ error: 'Server misconfiguration: ERP webhook secret missing.' });
  }

  if (!providedSecret || providedSecret !== erpWebhookSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid secret key.' });
  }

  return next();
};

module.exports = {
  verifyErpSecret,
};
