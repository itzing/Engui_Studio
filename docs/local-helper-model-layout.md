# Local Helper Model Layout

## Status

- Status: active production layout
- Scope: local llama.cpp-backed text and vision helper services used by Engui
- Purpose: define the canonical local model asset paths, service references, and rollback notes

## Canonical model directories

### Text prompt helper

- Model directory: `/home/engui/models/prompt-helper/`
- Active launch entrypoint: `/home/engui/prompt-helper-llama.sh`
- Active user unit: `/home/engui/.config/systemd/user/prompt-helper-llama.service`
- Active port: `8012`

### Vision prompt helper

- Model directory: `/home/engui/models/vision-prompt-helper/`
- Active user unit: `/home/engui/.config/systemd/user/vision-prompt-helper-llama.service`
- Active port: `8013`

## Active production assets

### Text helper

Current text helper service references the local text helper shell entrypoint:

- `/home/engui/prompt-helper-llama.sh`

That script currently launches:

- model: `/home/engui/models/prompt-helper/gemma-4-E2B-it-uncensored-Q4_K_M.gguf`

### Vision helper

Current production vision helper launches:

- model: `/home/engui/models/vision-prompt-helper/Qwen3-VL-8B-Abliterated-Caption-it.Q4_K_M.gguf`
- projector: `/home/engui/models/vision-prompt-helper/Qwen3-VL-8B-Abliterated-Caption-it.mmproj-f16.gguf`

Legacy 3B vision helper assets are intentionally still present in the same directory for rollback:

- `/home/engui/models/vision-prompt-helper/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf`
- `/home/engui/models/vision-prompt-helper/mmproj-F16.gguf`

## Active production vision service settings

Current stable launch settings for GTX 1060 6GB:

- `ctx-size 4096`
- `threads 6`
- `parallel 1`
- `batch-size 64`
- `ubatch-size 64`
- `cache-ram 0`
- `no-warmup`
- `no-webui`
- `n-gpu-layers 18`

## Runtime switching contract

Engui switches between text and vision helpers through:

- `src/lib/helperMode.ts`

The backend uses the internal route:

- `/api/internal-systemctl`

Helper mode responsibilities:

- stop the non-target helper service
- ensure the target helper service is active
- wait for the target helper health endpoint before continuing

## Health endpoints

- Text helper: `http://127.0.0.1:8012/health`
- Vision helper: `http://127.0.0.1:8013/health`

## Rollback

### Vision helper rollback

A backup of the previous user unit is preserved at:

- `/home/engui/.config/systemd/user/vision-prompt-helper-llama.service.bak-20260415-8b`

To roll back the production vision helper:

1. restore the backup unit file over the active user unit
2. run `systemctl --user daemon-reload` as Unix user `engui`
3. restart `vision-prompt-helper-llama.service`
4. verify `http://127.0.0.1:8013/health`

The legacy 3B model and projector remain in `/home/engui/models/vision-prompt-helper/` specifically so rollback does not require a fresh download.

## Canonical source of truth

For Engui local helper runtime layout, treat these as canonical:

- this document for paths and rollback notes
- `src/lib/helperMode.ts` for switching behavior
- the user systemd unit files under `/home/engui/.config/systemd/user/`

Benchmark experiments remain separate in:

- `/var/lib/openclaw/.openclaw/workspace/projects/vlm-benchmarks`

That project is intentionally not the production source of truth.
