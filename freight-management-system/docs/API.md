# Freight Management System API

This document outlines the API endpoints for the Freight Management System.

## Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration

## Freight

- `GET /api/freight/rates` - Get freight rates
- `POST /api/freight/calculate` - Calculate freight cost

## Shipments

- `GET /api/shipments` - Get all shipments
- `GET /api/shipments/:id` - Get a single shipment
- `POST /api/shipments` - Create a new shipment
- `PUT /api/shipments/:id` - Update a shipment
- `DELETE /api/shipments/:id` - Delete a shipment

## Admin

- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get a single user
- `PUT /api/admin/users/:id` - Update a user
- `DELETE /api/admin/users/:id` - Delete a user