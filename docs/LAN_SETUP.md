# LAN / Multi-User Setup Guide

To use the Freight Management System like Tally (on multiple computers in the same network):

## 1. Server Setup
1.  Run the backend on the host machine.
    ```bash
    cd backend
    npm run dev:desktop
    ```
    The server listens on `0.0.0.0`, meaning it accepts connections from other computers.

2.  Find the Host IP Address.
    -   Open CMD and run `ipconfig`.
    -   Look for IPv4 Address (e.g., `192.168.1.50`).

## 2. Dynamic Storage (Tally-like Data)
1.  Open the Admin Dashboard on the host (`http://localhost:5173`).
2.  Go to **Settings > Storage**.
3.  Enter the path where you want data stored (e.g., `D:/FreightData`).
    -   All uploaded files (invoices, PODs) will be saved there.
    -   The SQLite database (`freight.db`) is separate but can be backed up from `backend/backups`.

## 3. Connecting Client Computers
1.  On another computer in the same Wi-Fi/LAN.
2.  Open a browser (Chrome/Edge).
3.  Enter: `http://<HOST_IP>:5173` (e.g., `http://192.168.1.50:5173`).
    *(Note: This requires the Frontend to be served on the network too using `npm run dev -- --host` or the Desktop production build).*

## 4. Role Access
Login with the seeded credentials to test permissions:
-   **Admin**: `admin@freight.com` / `admin123`
-   **Company Admin**: `company@freight.com` / `company123`
-   **Finance**: `finance@freight.com` / `finance123`
-   **Operations**: `ops@freight.com` / `ops123`
-   **Transporter/Agent**: `agent@freight.com` / `agent123`

## Troubleshooting
-   **Firewall**: Ensure Windows Firewall allows Node.js connections on port 3000 (Backend) and 5173 (Frontend).
-   **Connectivity**: Try `ping <HOST_IP>` from the client machine.
