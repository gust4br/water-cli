# water 💧

A tiny interactive CLI for tracking daily water intake. Zero dependencies, just Node.js.

## Run

```sh
node water.js
# or, after `npm link`:
water
```

On the first run of each day it asks for your goal (Enter reuses yesterday's, default 2000ml). A progress bar stays pinned to the top of the terminal while you type commands.

## Commands

| Command | Description |
|---|---|
| `/add <amount>` | Log water: `500ml`, `500`, `1.5l` (1–5000ml) |
| `/undo` | Remove the last entry |
| `/goal <amount>` | Change today's goal |
| `/status` | Show recent entries and ml remaining |
| `/history` | Last 7 days |
| `/help` | List commands |
| `/quit` | Exit |

## Data

Stored in `water.json` next to `water.js`, keyed by date:

```json
{ "2026-11-10": { "goal": 3000, "log": [{ "ml": 200, "t": "10:49" }] } }
```

## Notes

- Requires a terminal with ANSI escape support.
- A session left open past midnight keeps logging to the old day; restart to roll over.
