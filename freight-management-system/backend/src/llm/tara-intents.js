module.exports = [
  {
    action: 'get_shipments',
    examples: [
      'show my shipments',
      'list shipments needing attention',
      'which loads are pending',
      'shipment summary please',
      'give me today shipments',
      'any deliveries completed today',
      'status of shipments in transit',
      'show active loads',
    ],
  },
  {
    action: 'get_quotes',
    examples: [
      'show pending quotes',
      'do we have any quote requests',
      'quote status update',
      'list transporter responses',
      'open quotations right now',
      'quotes awaiting approval',
      'pricing responses received',
    ],
  },
  {
    action: 'get_assignments',
    examples: [
      'which assignments need confirmation',
      'show transporter assignments',
      'do we have loads without drivers',
      'assignments waiting for response',
      'transporter tasks pending',
      'loads needing driver info',
    ],
  },
  {
    action: 'update_shipment',
    examples: [
      'mark shipment as delivered',
      'update shipment status',
      'set this load to completed',
      'change shipment to in transit',
      'close shipment after delivery',
      'update the driver details for shipment',
    ],
  },
  {
    action: 'help',
    examples: [
      'what can you do',
      'help me',
      'list your commands',
      'show me examples',
      'how do i use tara',
    ],
  },
];
