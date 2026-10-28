# RunPod connection health check

## Scope

Fix POST /api/settings/test for service=runpod. This is a shared backend correction; UI layout, GraphQL balance, generation payloads, endpoint images, and unrelated provider checks stay unchanged.

## Behavior

- Require non-empty string API key and endpoint ID; trim both and encode the endpoint path component.
- Send one authenticated GET to the Serverless /health operation on api.runpod.ai with cache disabled, redirects rejected, and a 10-second timeout.
- A successful HTTP response confirms connectivity, not GPU readiness. Zero workers is valid and must not enqueue work.
- Keep the existing success/message/responseTime/statusCode/endpoint response shape. Report known upstream status failures and generic network/timeout failures in English without reflecting response bodies or credentials.
- Delete the unused testRunPodConnection helper, including its GraphQL fallback and POST /run probe.

## Validation and delivery

Use route tests with a mocked upstream fetch for health success, zero workers, authentication/permission/missing endpoint/rate limiting/server errors, non-JSON errors, invalid input, timeout, and network failure. Assert that the only upstream request is a GET health check with no request body. Build production, commit/push as the owner, restart engui-studio.service, and verify live HTTP responses without launching any jobs.

## Rollback

Revert the implementation commit, rebuild production, and restart engui-studio.service. No data migrations or endpoint changes are involved.

## Reference

https://docs.runpod.io/serverless/endpoints/send-requests

## Verification

On 2026-10-28, all 18 focused tests and the production build passed. The deployed route successfully checked the configured Krea2 Turbo endpoint with a health-only request (HTTP 200, 433 ms). No generation jobs were launched. Root/mobile gallery smoke checks and missing-credentials validation also passed. Build logs note that the existing Next.js configuration skips TypeScript validation and linting; this release does not claim a full-repository type/lint pass.
