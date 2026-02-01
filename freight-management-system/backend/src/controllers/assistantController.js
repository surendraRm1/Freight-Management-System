const TaraAgent = require('../llm/tara-agent');

const taraAgent = new TaraAgent();

const assistantQuery = async (req, res) => {
  try {
    const rawMessage = req.body ? req.body.message ?? req.body.query : '';
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    const userContext = {
      id: req.user?.id || null,
      role: req.user?.role || 'USER',
      companyId: req.user?.companyId || null,
      vendorId: req.user?.vendorId || null,
    };

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const response = await taraAgent.processQuery(userContext, message);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      text: `[Error] Assistant error: ${error.message}`,
      success: false,
    });
  }
};

module.exports = {
  assistantQuery,
};
