# ENGUI-307 - Add LoRA selector to Studio run settings

Status: done

## Request
Update desktop Studio run settings:

- Add a LoRA selector like desktop Create Image.
- Save selected LoRAs and weights into run generation settings for the next launch.
- Remove `Shot count`, `Resolution`, and `Framing` info rows.
- Keep scope desktop-only.

## Rollback
Revert the implementation commit and restart `engui-studio.service`.
