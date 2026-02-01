# LAN Testing Guide

Use this guide to let teammates on the same Wi-Fi network access your dev instance without deploying.

## 1. Configure environment variables

### Backend (`backend/.env`)

Add every UI origin that should be allowed, separated by commas:

```
FRONTEND_URLS="http://localhost:5173,http://192.168.1.40:5173"
```

Replace `192.168.1.40` with your machine's IPv4 address (see step 2). Keep `http://localhost:5173` so your own browser continues to work.

### Frontend (`frontend/.env`)

Point the app at the backend URL other devices will hit:

```
VITE_API_URL=http://192.168.1.40:5000
VITE_DEV_HOST=0.0.0.0
VITE_DEV_PORT=5173
```

`VITE_DEV_HOST` and `VITE_DEV_PORT` are already set to expose Vite on all interfaces, so you normally only edit `VITE_API_URL`.

## 2. Find your LAN IP

Run `ipconfig` in PowerShell and grab the `IPv4 Address` from the Wi-Fi adapter (usually `192.168.x.x`). This is the host portion you used above.

## 3. Start the backend

```
cd backend
npm install
npm run dev
```

The API listens on `http://0.0.0.0:5000`, so it is reachable from other devices once Windows Defender Firewall allows it.

## 4. Start the frontend

```
cd frontend
npm install
npm run dev
```

Because the Vite server host is set to `0.0.0.0`, teammates can open `http://<your-ip>:5173`.

## 5. Open firewall ports

If Windows prompts you the first time you run the servers, choose "Allow access" for both private networks on the Node.js process. To add the rules manually:

```
netsh advfirewall firewall add rule name="Freight Backend 5000" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="Freight Frontend 5173" dir=in action=allow protocol=TCP localport=5173
```

Remove the rules after testing if this is a shared or untrusted network.

## 6. Share the URLs

1. Ask a teammate to hit `http://<your-ip>:5000/health` to confirm the API responds.
2. Have them open `http://<your-ip>:5173` in a browser and log in.

## 7. Clean up

When testing ends, stop both terminals (`Ctrl+C`) and, if needed, delete the firewall rules to close the ports.
