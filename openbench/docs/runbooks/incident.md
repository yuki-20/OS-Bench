# Incident runbook

This runbook covers common operational issues. The product itself is *not* an incident
response tool — for actual lab emergencies, follow your institution's procedures.

## Run is stuck in `blocked`

1. Open `Console → Runs → (run id)`.
2. Inspect the latest `block_triggered` event in the timeline.
3. If the cause is a deviation, resolve it from the Deviations queue.
4. If the cause is a missing photo confirmation, ask the operator to retake the photo
   and re-run the visual check.
5. If a manager wants to allow the run to continue past a critical block, they can
   approve the override request from the run detail page.

## Webhook deliveries failing

1. Check `Settings → Webhooks` for the target URL.
2. Look at recent deliveries: `docker compose exec db psql -U openbench -d openbench
   -c "SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT 10;"`.
3. Verify the receiver responds 2xx within 10 seconds. Re-send with:
   `POST /api/integrations/webhooks/test` (planned).

## API container won't start (Alembic error)

The API runs `alembic upgrade head` on boot. If migrations fail:

```bash
docker compose exec api alembic current
docker compose exec api alembic history --verbose
```

Roll back if needed: `docker compose exec api alembic downgrade -1`.

## Vision checks always return `cannot_verify`

- Inspect the uploaded photo (`Console → Run → Photo assessments`). Blurry or dark images
  produce conservative results — that is the intended behavior.
- Re-take with better lighting and a closer framing of the labels and containment.
- Ensure the protocol's `visual_checks_json` actually contains items (the compiler omits
  them if the source documents do not warrant any visual check).
