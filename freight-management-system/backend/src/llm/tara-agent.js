const OperationsManager = require('./operations-manager');
const BusinessRules = require('./business-rules');
const IntentMatcher = require('./intent-matcher');

const formatCurrency = (value) => {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const extractFirst = (records, count = 10) => {
  if (!Array.isArray(records) || !records.length) {
    return [];
  }
  return records.slice(0, count);
};

class TaraAgent {
  constructor(prisma) {
    this.operations = new OperationsManager(prisma);
    this.rules = new BusinessRules();
    this.intentMatcher = new IntentMatcher();
  }

  async processQuery(userContext = {}, userMessage) {
    try {
      const userRole = userContext.role || 'USER';
      const userId = userContext.id || null;
      let intent = null;
      let confidence = null;

      if (this.intentMatcher?.enabled) {
        const match = await this.intentMatcher.match(userMessage || '');
        if (match?.action) {
          intent = this.buildIntent(match.action, userMessage);
          confidence = match.score;
        }
      }

      if (!intent) {
        intent = this.parseIntent(userMessage || '');
      }

      if (!intent || intent.action === 'help') {
        const helpText = this.rules.helpMessage();
        return this.formatResponse(helpText, { highlights: { total: 0 }, confidence });
      }

      if (!this.rules.hasPermission(userRole, intent.action)) {
        return this.formatResponse(
          `[Error] Permission denied. Your role (${userRole}) cannot perform: ${intent.action}`,
          { denied: intent.action },
        );
      }

      let result = null;

      switch (intent.action) {
        case 'get_shipments':
          result = await this.operations.getShipments(intent.params, userContext);
          break;
        case 'get_quotes':
          result = await this.operations.getQuoteRequests(intent.params, userContext);
          break;
        case 'update_shipment':
          result = await this.operations.updateShipment(intent.params, userContext);
          break;
        case 'get_assignments':
          result = await this.operations.getTransporterAssignments(intent.params, userContext);
          break;
        default:
          return this.formatResponse(
            `[Hint] I understand you want help with: "${userMessage}". Please specify shipments, quotes, assignments, or payments.`,
          );
      }

      const warnings = this.rules.checkCompliance(result);
      const highlights = this.rules.buildHighlights(intent.action, result);
      const text = this.formatOperationalResponse(result, intent.action, warnings);

      return this.formatResponse(text, {
        highlights,
        records: result,
        confidence,
      });
    } catch (error) {
      return this.formatError(error);
    }
  }

  parseIntent(message) {
    const lowerMsg = String(message).toLowerCase();

    if (lowerMsg.includes('help') || lowerMsg === '?') {
      return this.buildIntent('help', message);
    }

    if (lowerMsg.includes('shipment')) {
      if (lowerMsg.includes('update') || lowerMsg.includes('change') || lowerMsg.includes('mark')) {
        return this.buildIntent('update_shipment', message);
      }
      return this.buildIntent('get_shipments', message);
    }

    if (lowerMsg.includes('quote') || lowerMsg.includes('pricing')) {
      return this.buildIntent('get_quotes', message);
    }

    if (lowerMsg.includes('assignment') || lowerMsg.includes('assign') || lowerMsg.includes('transporter')) {
      return this.buildIntent('get_assignments', message);
    }

    return this.buildIntent('help', message);
  }

  buildIntent(action, message) {
    switch (action) {
      case 'get_shipments':
      case 'get_quotes':
      case 'get_assignments':
        return { action, params: this.extractFilters(message) };
      case 'update_shipment': {
        const shipmentId = this.extractId(message, 'ship');
        const status = this.extractStatus(message);
        return { action, params: { shipment_id: shipmentId, status } };
      }
      case 'help':
        return { action: 'help', params: {} };
      default:
        return null;
    }
  }

  extractFilters(message) {
    const filters = {};
    const lower = String(message).toLowerCase();

    if (lower.includes('pending')) filters.status = 'pending';
    if (lower.includes('completed') || lower.includes('delivered')) filters.status = 'delivered';
    if (lower.includes('in transit')) filters.status = 'in_transit';
    if (lower.includes('active')) filters.status = 'active';
    if (lower.includes('attention') || lower.includes('flag')) filters.status = 'attention';

    if (lower.includes('today')) filters.date = 'today';
    if (lower.includes('yesterday')) filters.date = 'yesterday';

    const vendorMatch = message.match(/vendor\s+(\d+)/i) || message.match(/transporter\s+(\d+)/i);
    if (vendorMatch) {
      filters.vendorId = vendorMatch[1];
    }

    const limitMatch = message.match(/top\s+(\d+)/i);
    if (limitMatch) {
      filters.limit = Number.parseInt(limitMatch[1], 10);
    }

    return filters;
  }

  extractId(message, prefix) {
    if (!message) return null;
    const pattern = new RegExp(`(${prefix}\\w*[-_]?)\\s*([0-9]+)`, 'i');
    const match = message.match(pattern);
    if (match && match[2]) {
      return match[2];
    }

    const numericMatch = message.match(/#?(\d{3,})/);
    if (numericMatch && numericMatch[1]) {
      return numericMatch[1];
    }

    const tokenMatch = message.match(/(SHIP|QUOTE|PAY)-[A-Z0-9]+/i);
    return tokenMatch ? tokenMatch[0] : null;
  }

  extractStatus(message) {
    if (!message) return null;
    const statusMatch = message.match(/status\s+(to\s+)?([a-z\s_]+)/i);
    if (statusMatch && statusMatch[2]) {
      return statusMatch[2].trim();
    }
    if (message.toLowerCase().includes('delivered')) return 'delivered';
    if (message.toLowerCase().includes('assigned')) return 'assigned';
    if (message.toLowerCase().includes('cancel')) return 'cancelled';
    return null;
  }

  formatOperationalResponse(data, action, warnings = []) {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return `[Hint] No ${action.replace('get_', '')} found matching your criteria.`;
    }

    let response = `[Tara] **${this.formatActionName(action)}**\n\n`;
    const tables = [];

    if (action === 'get_shipments') {
      const { summary, table } = this.formatShipmentsTable(data);
      response += summary;
      if (table) tables.push(table);
    } else if (action === 'get_quotes') {
      const { summary, table } = this.formatQuotesTable(data);
      response += summary;
      if (table) tables.push(table);
    } else if (action === 'get_assignments') {
      const { summary, table } = this.formatAssignmentsTable(data);
      response += summary;
      if (table) tables.push(table);
    } else if (action === 'update_shipment') {
      const shipment = data;
      response += `Shipment ${shipment.trackingNumber || shipment.id} updated to **${shipment.status}**.`;
      const { summary, table } = this.formatShipmentsTable([shipment]);
      response += `\n\n${summary}`;
      if (table) tables.push(table);
    }

    if (warnings.length) {
      response += `\n\n[Alert] Compliance Alerts:\n${warnings.map((warning) => `- ${warning}`).join('\n')}`;
      const alertObjects = warnings.map((warning) => ({
        type: 'alert',
        level: 'warning',
        message: warning,
      }));
      tables.push(...alertObjects);
    }

    tables.forEach((table) => {
      response += `\n\n\`\`\`json\n${JSON.stringify(table, null, 2)}\n\`\`\``;
    });

    response += `\n\n**Next steps:** ${this.suggestNextSteps(action)}`;
    return response;
  }

  formatShipmentsTable(shipments) {
    const list = extractFirst(Array.isArray(shipments) ? shipments : [shipments], 10);
    if (!list.length) {
      return {
        summary: 'No shipments available for this filter.',
        table: null,
      };
    }

    const summary = list
      .slice(0, 3)
      .map((shipment) => {
        const id = shipment.trackingNumber || shipment.id;
        const route = `${shipment.fromLocation} -> ${shipment.toLocation}`;
        const vendor = shipment.vendor?.name || 'Unassigned';
        return `- ${id}: ${shipment.status} | ${route} | ${vendor}`;
      })
      .join('\n');

    const table = {
      type: 'table',
      title: 'Shipment Overview',
      headers: ['ID', 'Status', 'Route', 'Transporter', 'Cost'],
      rows: list.map((shipment) => ({
        ID: shipment.trackingNumber || shipment.id,
        Status: shipment.status,
        Route: `${shipment.fromLocation} -> ${shipment.toLocation}`,
        Transporter: shipment.vendor?.name || 'Unassigned',
        Cost: formatCurrency(shipment.cost),
      })),
    };

    return {
      summary,
      table,
    };
  }

  formatQuotesTable(quotes) {
    const list = extractFirst(quotes, 10);
    if (!list.length) {
      return {
        summary: 'No quote requests match this filter.',
        table: null,
      };
    }

    const summary = list
      .slice(0, 3)
      .map((quote) => {
        const responses = quote.responses?.length || 0;
        return `- Quote ${quote.id}: ${quote.status} | ${quote.fromLocation} -> ${quote.toLocation} | responses: ${responses}`;
      })
      .join('\n');

    const table = {
      type: 'table',
      title: 'Quote Requests',
      headers: ['ID', 'Status', 'Route', 'Responses', 'Last Update'],
      rows: list.map((quote) => ({
        ID: quote.id,
        Status: quote.status,
        Route: `${quote.fromLocation} -> ${quote.toLocation}`,
        Responses: Array.isArray(quote.responses) ? quote.responses.length : 0,
        'Last Update': quote.updatedAt ? new Date(quote.updatedAt).toLocaleString() : 'N/A',
      })),
    };

    return {
      summary,
      table,
    };
  }

  formatAssignmentsTable(assignments) {
    const list = extractFirst(assignments, 10);
    if (!list.length) {
      return {
        summary: 'No transporter assignments require action.',
        table: null,
      };
    }

    const summary = list
      .slice(0, 3)
      .map((shipment) => {
        const id = shipment.trackingNumber || shipment.id;
        const vendor = shipment.vendor?.name || 'Unassigned';
        const driver = shipment.assignedDriver || 'Pending';
        return `- ${id}: ${shipment.status} | ${vendor} | driver: ${driver}`;
      })
      .join('\n');

    const table = {
      type: 'table',
      title: 'Transporter Assignments',
      headers: ['ID', 'Status', 'Transporter', 'Driver', 'Compliance'],
      rows: list.map((shipment) => ({
        ID: shipment.trackingNumber || shipment.id,
        Status: shipment.status,
        Transporter: shipment.vendor?.name || 'Unassigned',
        Driver: shipment.assignedDriver || 'Pending',
        Compliance: shipment.complianceStatus || 'PENDING',
      })),
    };

    return {
      summary,
      table,
    };
  }

  formatActionName(action) {
    const names = {
      get_shipments: 'Shipment Overview',
      get_quotes: 'Quote Requests',
      get_assignments: 'Transporter Assignments',
      update_shipment: 'Shipment Updated',
    };
    return names[action] || action;
  }

  suggestNextSteps(action) {
    const steps = {
      get_shipments: 'Ask "Show assignments needing drivers" or "Update shipment SHIP-123 to delivered".',
      get_quotes: 'Ask "Show pending transporter responses" or "Approve quote 42".',
      get_assignments: 'Ask "List compliance pending shipments" or "Update shipment SHIP-123 with driver details".',
      update_shipment: 'Review other active shipments or confirm transporter assignments.',
      default: 'What would you like to do next?',
    };
    return steps[action] || steps.default;
  }

  formatResponse(text, data = {}) {
    return {
      text,
      data,
      timestamp: new Date().toISOString(),
      success: !text.includes('[Error]') && !text.includes('System error'),
    };
  }

  formatError(error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return this.formatResponse(`[Error] System error: ${message}. Please try again or contact support.`);
  }
}

module.exports = TaraAgent;
