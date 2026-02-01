# Deployment Guide for Freight Management System

This guide outlines the steps to deploy the Freight Management System on a Linux VPS (Ubuntu 20.04/22.04 LTS).

## 1. Prerequisites

- **VPS**: A server with at least 2GB RAM (4GB recommended).
- **OS**: Ubuntu 20.04 or 22.04.
- **Node.js**: Version 18 or higher.
- **Database**: PostgreSQL (Managed or Local).
- **Web Server**: Nginx (as a reverse proxy).
- **Process Manager**: PM2.

## 2. Server Setup

### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install PM2
```bash
sudo npm install -g pm2
```

### Install Nginx
```bash
sudo apt update
sudo apt install nginx
```

## 3. Application Setup

### Clone Codebase
Upload your code to `/var/www/freight-management-system`.

### Backend Setup
1. Navigate to backend:
   ```bash
   cd /var/www/freight-management-system/backend
   ```
2. Install dependencies:
   ```bash
   npm install --production
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Setup `.env` file:
   Create a `.env` file with the following keys:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://user:password@localhost:5432/freight_db"
   JWT_SECRET="your_strong_secret"
   FRONTEND_URL="https://your-domain.com"
   SMTP_HOST="smtp.example.com"
   SMTP_USER="user"
   SMTP_PASS="pass"
   REDIS_URL="redis://localhost:6379"
   ```
5. Run migrations:
   ```bash
   npm run prisma:migrate
   ```
6. Start with PM2:
   ```bash
   pm2 start src/server.js --name "freight-backend"
   ```

### Frontend Setup
1. Navigate to frontend:
   ```bash
   cd /var/www/freight-management-system/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.production`:
   ```env
   VITE_API_URL="https://api.your-domain.com"
   ```
4. Build the project:
   ```bash
   npm run build
   ```
   This will create a `dist` folder.

## 4. Nginx Configuration

Create a config file at `/etc/nginx/sites-available/freight`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/freight-management-system/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/freight /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. SSL (Optional but Recommended)
Install Certbot and enable HTTPS:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

## 6. Monitoring & Alerting
- Forward backend logs (`combined.log`, `error.log`) to a log aggregation service (e.g., CloudWatch, ELK, or Grafana Loki) and configure alerts for 5XX spikes, login failures, and webhook errors.
- Enable basic uptime monitoring (Pingdom, UptimeRobot, or HealthChecks) against `/health` for every environment.
- Capture infrastructure metrics (CPU, memory, disk, Postgres connections, Redis status) via tools such as Prometheus + Grafana or your cloud provider’s monitoring stack. Alert when thresholds exceed 80%.
- See `docs/monitoring.md` for a ready-to-use blueprint of metrics and alert thresholds.

## 7. Backup & Disaster Recovery
- **Database**: schedule automated PostgreSQL backups (pgBackRest, wal-g, or managed snapshots) at least hourly with a 30-day retention policy. Test restoring into a staging environment monthly.
- **Redis**: if using volatile data (token revocation, caches), enable append-only persistence or document procedures for cold restores.
- **Uploads**: move uploaded documents to an object store (S3/GCS) with lifecycle policies and versioning enabled. Ensure KMS-encrypted buckets and cross-region replication if required.
- Maintain an incident runbook that covers restoring backups, rotating secrets, revoking compromised tokens, and re-populating caches. Store the runbook with your on-call rotation.
