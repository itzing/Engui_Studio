# ENGUI-311 - Show LoRAs used in job details

Status: done

## Request
Add LoRA usage information to Job Details on both desktop and mobile so Studio run jobs visibly show which LoRAs were used.

## Scope
- Desktop `JobDetailsDialog`
- Mobile job details screen
- Read from persisted job options, including Z-Image `zImageLoraSlots`, simple `lora`/`lora2`... slots, and array-style `lora` entries.

## Rollback
Revert the implementation commit and restart `engui-studio.service`.
