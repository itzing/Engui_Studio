# engui-201.2 - Add generic job materialization task framework and supervisor registry

## Summary
Create a reusable materialization task model plus handler registry so generated job outputs can be attached to different domain targets by backend infrastructure.

## Scope
- Add a generic `JobMaterializationTask` Prisma model.
- Implement task enqueue/update helpers.
- Add handler registry and supervisor dispatch/recovery.
- Support task statuses such as pending, processing, materialized, and failed.

## Acceptance Criteria
- Generic materialization tasks can be created and recovered.
- Supervisor can dispatch by target type.
- Task lifecycle state is durable and inspectable.
