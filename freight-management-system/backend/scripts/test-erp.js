const axios = require('axios');

async function testErpWebhook() {
    try {
        const response = await axios.post('http://localhost:5000/api/v1/erp-webhook?company=cm3i5u6j50001v8ltm0w82a4i', {
            customer_name: 'Test Customer',
            pickup_details: { address: '123 Pickup St' },
            delivery_details: { address: '456 Delivery Ave' },
            items: [{ name: 'Widget', quantity: 10 }],
            erp_order_id: 'ERP-12345'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-secret-key': 'your-secret-key-here' // Note: This needs to match a real company secret in DB
            }
        });
        console.log('Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error Status:', error.response.status);
            console.log('Error Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testErpWebhook();
