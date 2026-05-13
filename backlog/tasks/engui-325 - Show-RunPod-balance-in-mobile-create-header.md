---
id: ENGUI-325
title: Show RunPod balance in mobile create header
status: Done
created: 2026-05-13
---

## Goal

Show the current RunPod account balance in the mobile create top bar where the user marked it in the screenshot.

## Requirements

- Display only the currency amount, e.g. `$2.83`.
- Fetch once when the mobile create screen first opens.
- Refresh when the user taps the displayed amount.
- Do not poll automatically.
- Do not expose the RunPod API key to the client.
- Use the existing Engui RunPod settings for `user-with-settings` until real users/auth are introduced.

## Notes

RunPod balance was verified through GraphQL:

```graphql
query {
  myself {
    clientBalance
    currentSpendPerHr
    spendLimit
  }
}
```

Endpoint:

```text
POST https://api.runpod.io/graphql
```
