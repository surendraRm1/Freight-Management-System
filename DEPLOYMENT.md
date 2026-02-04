# Deployment Guide

This guide covers how to containerise and run every service (backend, frontend, AI service, and PostgreSQL) along with the minimal infrastructure requirements. Adapt the instructions to your preferred cloud platform (AWS ECS/EKS, Azure AKS/App Service, GCP Cloud Run/GKE, etc.).

## Services overview

| Service | Port | Dockerfile | Health |
| --- | --- | --- | --- |
| Backend API (Node/Express) | `9581` | `freight-management-system/backend/Dockerfile` | `/health` |
| Frontend SPA (Vite/React) | `80` (inside container) | `freight-management-system/frontend/Dockerfile` | `/health` (nginx stub) |
| AI Service (FastAPI) | `9000` | `freight-management-system/ai-service/Dockerfile` | `/` |
| PostgreSQL | `5432` | (use managed DB or docker image) | native |

## Environment variables

- Copy `freight-management-system/backend/.env.example` → `.env` and fill in production values (DB URL, JWT secret, SMTP, OpenAI, Twilio, `AI_SERVICE_URL`, etc.).
- Copy `freight-management-system/ai-service/.env.example` → `.env` if you need to override host/port/log level.
- Never commit real secrets; store them in a secret manager (AWS Secrets Manager, Azure Key Vault, etc.) and inject them at runtime.

## Local Docker Compose (for testing)

1. Duplicate the backend `.env` file with non-production secrets.
2. Run:
   ```bash
   docker compose -f docker-compose.example.yml up --build
   ```
3. Access the services:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:9581 (CORS already allows localhost by default)
   - AI Service: http://localhost:9000
   - Postgres: localhost:9582 (mapped from container 5432)

## Production deployment suggestions

### Backend API
- Build the container:
  ```bash
  docker build -t fms-backend ./freight-management-system/backend
  ```
- Run via ECS/Fargate, Kubernetes, or a VM with systemd/pm2. Expose port 9581 behind an HTTPS load balancer.
- Mount/log forwarding: configure CloudWatch/Stackdriver by pointing Winston transports to stdout or a log agent.

### Frontend SPA
- Build container or upload `/frontend/dist` to an object store + CDN (e.g., S3 + CloudFront).
- If using the container, deploy behind a CDN/ALB and enable HTTPS termination before nginx.

### AI Service
- Build:
  ```bash
  docker build -t fms-ai ./freight-management-system/ai-service
  ```
- Run internally (no public exposure) so only the backend can access it. Configure security groups/firewalls accordingly.

### PostgreSQL
- Prefer a managed database (AWS RDS/Aurora, Azure Database for PostgreSQL, GCP Cloud SQL) with automated backups and encryption at rest.
- Update `DATABASE_URL` in the backend environment to point at the managed instance.

## Reverse proxy & networking

- Use Nginx/ALB/API Gateway to route:
  - `/api/*` → backend service
  - `/ai/*` (optional) → FastAPI service
  - `/` → frontend (CDN or nginx).
- Terminate TLS at the proxy; keep internal traffic on a private network.

## Observability & scaling

- Enable application logs (stdout) → central logging (CloudWatch Logs, Azure Monitor, etc.).
- Add metrics/alerts for CPU, memory, error rates, and Postgres health.
- Set up automated backups for Postgres and object storage (uploads, logs).
- Define autoscaling policies if using ECS/Kubernetes.

## CI/CD pipeline outline

1. **Build & test**: run `npm test` (backend) and `npm run build` (frontend).
2. **Prisma migrations**: `npx prisma migrate deploy` against the target database.
3. **Docker image build**: build/push backend, frontend, and AI service images.
4. **Deploy**: update the orchestrator (ECS/K8s) and invalidate CDN caches.

## File uploads & exports

- Store uploads in an object store (S3/Blob Storage) with per-company prefixes and IAM policies to avoid cross-tenant access.
- Ensure export endpoints verify `companyId` before generating files; consider server-side encryption with customer-managed keys.

## Checklist before go-live

- [ ] Secrets stored in a vault; `.env` not committed.
- [ ] TLS certificates installed on the proxy.
- [ ] Monitoring and alerts configured for all services.
- [ ] Automated backups for database and uploaded files.
- [ ] Disaster recovery runbook documented.
- [ ] Penetration/security tests performed on staging.
