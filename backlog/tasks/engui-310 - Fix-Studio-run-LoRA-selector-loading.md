# ENGUI-310 - Fix Studio run LoRA selector loading

Status: done

## Request
Fix desktop Studio run settings where clicking `Add LoRA` opens the selector but it stays on `Loading LoRAs…` forever.

## Root cause
The LoRA loading effect depended on `isLoadingLoras`. Setting loading to `true` retriggered the effect cleanup, marked the in-flight request as cancelled, and prevented `finally` from resetting loading state.

## Implementation
- Removed `isLoadingLoras` from the loader effect dependency/guard cycle.
- Load LoRAs when either run settings or the LoRA selector is open.
- Added a visible error state and retry control instead of infinite loading.

## Rollback
Revert the implementation commit and restart `engui-studio.service`.
