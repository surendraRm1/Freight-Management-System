# Freight Management AI Service

This folder contains the FastAPI microservice that powers AI/intent features. Follow the steps below to run it locally and prepare it for deployment.

## Prerequisites

- Python 3.11 or later (matching the production runtime).
- `pip` and `venv` available on your PATH.
- Optional: Docker/compose if you prefer containerised deployment.

## Local Setup

```powershell
cd freight-management-system/ai-service
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `AI_SERVICE_HOST` | Bind address for uvicorn | `0.0.0.0` |
| `AI_SERVICE_PORT` | Port for uvicorn | `9000` |
| `LOG_LEVEL` | FastAPI/Uvicorn log level | `info` |

> The current endpoints are mock implementations. Add secrets (OpenAI, internal APIs, etc.) here once you integrate real models.

## Running the service

```powershell
# From freight-management-system/ai-service with venv activated
$env:AI_SERVICE_HOST="0.0.0.0"
$env:AI_SERVICE_PORT="9000"
uvicorn app.main:app --host $env:AI_SERVICE_HOST --port $env:AI_SERVICE_PORT --reload
```

Navigate to `http://localhost:9000/docs` for interactive Swagger docs.

## Production deployment options

1. **Systemd / Supervisor**  
   - Create a dedicated UNIX user, copy the project, and define a systemd unit that activates the venv and runs `uvicorn app.main:app --host 0.0.0.0 --port 9000`.
   - Configure Nginx/ALB to reverse-proxy traffic to the service.

2. **Docker**  
   - Add a simple `Dockerfile`:
     ```Dockerfile
     FROM python:3.11-slim
     WORKDIR /app
     COPY requirements.txt .
     RUN pip install --no-cache-dir -r requirements.txt
     COPY app ./app
     CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
     ```
   - Build & push the image, then deploy via ECS/EKS/AKS/GKE or any container platform.

3. **Serverless (Cloud Run / Azure Container Apps / AWS Lambda + API Gateway)**  
   - Package the FastAPI app inside a container and deploy to the managed service. Ensure cold-start latency meets your SLA.

## Health checks & monitoring

- Use the `/` endpoint for liveness probes.
- Add metrics/log shipping (e.g., Prometheus, CloudWatch) in production.

## Next steps

- Replace the mock `/analyze-intent` logic with your actual NLP/LLM pipeline.
- Add authentication/authorization if exposed beyond the internal network.
- Write unit tests once business logic is in place.
