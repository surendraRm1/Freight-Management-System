const {
  ComplianceStatus,
  QuoteResponseStatus,
  QuoteStatus,
  ShipmentStatus,
} = require('@prisma/client');

const ROLE_PERMISSIONS = {
  super_admin: ['get_shipments', 'get_quotes', 'get_assignments', 'update_shipment', 'help'],
  admin: ['get_shipments', 'get_quotes', 'get_assignments', 'update_shipment', 'help'],
  company_admin: ['get_shipments', 'get_quotes', 'get_assignments', 'update_shipment', 'help'],
  finance_approver: ['get_shipments', 'get_quotes', 'help'],
  operations: ['get_shipments', 'get_assignments', 'update_shipment', 'help'],
  agent: ['get_shipments', 'get_assignments', 'update_shipment', 'help'],
  transporter: ['get_shipments', 'get_assignments', 'update_shipment', 'help'],
  vendor: ['get_assignments', 'get_shipments', 'help'],
  user: ['get_shipments', 'get_quotes', 'help'],
};

const ROLE_ALIASES = {
  administrator: 'super_admin',
  ops: 'operations',
  logistics: 'company_admin',
};

const normaliseRole = (role) => {
  if (!role) {
    return 'user';
  }
  const token = String(role).trim().toLowerCase();
  return ROLE_ALIASES[token] || token;
};

const asArray = (value) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const isPendingApproval = (status) => {
  if (!status) {
    return false;
  }
  return String(status).trim().toLowerCase() === 'pending_approval';
};

class BusinessRules {
  hasPermission(userRole, action) {
    if (!action) {
      return false;
    }
    const roleKey = normaliseRole(userRole);
    const permissions = ROLE_PERMISSIONS[roleKey] || ROLE_PERMISSIONS.user;
    return permissions.includes(action);
  }

  checkCompliance(data) {
    const warnings = [];
    const now = Date.now();

    asArray(data).forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const label = item.trackingNumber || item.trackingId || item.id || 'record';

      if (item.documents_expiry) {
        const expiry = new Date(item.documents_expiry);
        if (!Number.isNaN(expiry.valueOf()) && expiry.getTime() < now) {
          warnings.push(`Document expired for ${label}.`);
        }
      }

      if (isPendingApproval(item.status)) {
        warnings.push(`Approval pending for ${label}.`);
      }

      if (
        item.complianceStatus &&
        item.complianceStatus !== ComplianceStatus.APPROVED &&
        item.complianceStatus !== ComplianceStatus.EXEMPT
      ) {
        warnings.push(
          `Shipment ${label} has compliance status ${item.complianceStatus}.`,
        );
      }

      if (
        item.status &&
        [
          ShipmentStatus.ASSIGNED,
          ShipmentStatus.ACCEPTED,
          ShipmentStatus.PICKED_UP,
          ShipmentStatus.IN_TRANSIT,
        ].includes(item.status) &&
        !item.assignedDriver
      ) {
        warnings.push(`Shipment ${label} is ${item.status} but no driver is assigned.`);
      }

      if (Array.isArray(item.responses)) {
        item.responses.forEach((response) => {
          if (!response) {
            return;
          }
          if (
            (response.status === QuoteResponseStatus.PENDING ||
              response.status === QuoteResponseStatus.RESPONDED) &&
            response.expiresAt
          ) {
            const deadline = new Date(response.expiresAt);
            if (!Number.isNaN(deadline.valueOf()) && deadline.getTime() < now) {
              warnings.push(
                `Quote response ${response.id} for request ${item.id} is past expiry and needs review.`,
              );
            }
          }
        });

        if (
          item.status === QuoteStatus.PENDING &&
          !item.responses.some(
            (response) =>
              response.status === QuoteResponseStatus.RESPONDED ||
              response.status === QuoteResponseStatus.APPROVED,
          )
        ) {
          warnings.push(`Quote request ${item.id} is pending without transporter responses.`);
        }
      }
    });

    if (!warnings.length) {
      return [];
    }

    return Array.from(new Set(warnings));
  }

  buildHighlights(action, records) {
    const items = asArray(records);
    if (!items.length) {
      return { total: 0 };
    }

    switch (action) {
      case 'get_shipments':
      case 'update_shipment': {
        const delivered = items.filter(
          (item) => item.status === ShipmentStatus.DELIVERED,
        ).length;
        const attention = items.filter((item) =>
          [
            ShipmentStatus.REQUESTED,
            ShipmentStatus.ASSIGNED,
            ShipmentStatus.ACCEPTED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
          ].includes(item.status),
        ).length;
        return {
          total: items.length,
          delivered,
          attention,
        };
      }
      case 'get_quotes': {
        const pending = items.filter((item) => item.status === QuoteStatus.PENDING).length;
        const responded = items.filter(
          (item) => item.status === QuoteStatus.RESPONDED,
        ).length;
        const approved = items.filter(
          (item) => item.status === QuoteStatus.APPROVED,
        ).length;
        return {
          total: items.length,
          pending,
          responded,
          approved,
        };
      }
      case 'get_assignments': {
        const driverGaps = items.filter(
          (item) =>
            [ShipmentStatus.ASSIGNED, ShipmentStatus.ACCEPTED].includes(item.status) &&
            !item.assignedDriver,
        ).length;
        const compliancePending = items.filter(
          (item) =>
            item.complianceStatus &&
            item.complianceStatus !== ComplianceStatus.APPROVED &&
            item.complianceStatus !== ComplianceStatus.EXEMPT,
        ).length;
        return {
          total: items.length,
          driverGaps,
          compliancePending,
        };
      }
      default:
        return { total: items.length };
    }
  }

  helpMessage() {
    return [
      'Here are a few things you can ask:',
      '- "Show shipments that need attention"',
      '- "List pending compliance items"',
      '- "Which quotes are awaiting responses?"',
      '- "Update shipment SHIP-102 with status delivered"',
      '- "Show assignments for transporter 12"',
    ].join('\n');
  }
}

module.exports = BusinessRules;
