# Monitoring & Alerting Blueprint

This project expects each deployment to ship with the following guardrails:

1. **Application health**
   - Ping `/health` every 60 seconds from multiple regions (UptimeRobot, Pingdom, or CloudWatch Synthetics).
   - Alert if two consecutive probes fail or latency exceeds 2 s for 5 minutes.

2. **API metrics**
   - Stream `combined.log`/`error.log` to your log platform (Grafana Loki, DataDog, or CloudWatch Logs).
   - Create alerts for:
     - HTTP 5xx rate > 5% over 5 minutes.
     - Authentication failures > 20 per minute.
     - Webhook signature failures or ERP ingest errors.

3. **Infrastructure**
   - Collect CPU, memory, disk, and Postgres/Redis connection counts (Prometheus + Grafana Cloud or DataDog).
   - Thresholds: CPU > 80%, memory > 75%, Postgres active connections > 70% of limit.

4. **Background jobs**
   - Monitor the compliance notifier (if enabled) by tailing logs for the `Compliance notifier` prefix.
   - Alert if no “triggered” entry appears in 1 hour during business hours.

5. **Backups & DR**
   - Automatic PostgreSQL snapshots (hourly, 30-day retention) with restore drills at least monthly.
   - Redis persistence or documented rebuild steps.
   - Object storage buckets (uploads) with versioning and replication.

6. **On-call runbook**
   - Store the incident playbook (log locations, restart commands, rollback steps) in your knowledge base.
   - Rotate on-call engineers with clear escalation paths.

Complete these before go-live to satisfy enterprise monitoring expectations. Update this file as you wire up specific vendors/tools.
