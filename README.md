# FadeHost Server Status Bot

[![Deploy to FadeHost](https://fadehost.com/deploy-button.svg)](https://laplace.fadehost.com/register?intent=bot&repo=https://github.com/FadeHost/server-status-bot)

Your FadeHost game server, inside Discord:

- The bot's presence always shows the live player count ("Watching 4 players on Emberfell")
- `/status` — status, players and address in one embed
- `/players` — who is online right now
- `/ip` — the address to join
- `/start`, `/stop`, `/restart` — server control for members with **Manage Server**

Built and maintained by [FadeHost](https://fadehost.com). Works with any game
server on your FadeHost account.

## One-click hosting

Deploy it straight from the [FadeHost panel](https://laplace.fadehost.com/bots):
**Bots → New bot → Server Status Bot**. The form asks for the two tokens below
and the bot is online in about a minute.

## Configuration

| Variable | Required | What it is |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token from [discord.com/developers](https://discord.com/developers/applications) → New Application → Bot → Reset Token |
| `FADEHOST_TOKEN` | yes | FadeHost AI-access token with the **manage** scope, from [your profile](https://laplace.fadehost.com/profile/ai-access) |
| `SERVER_ID` | no | A `server_…` id if you have several servers; defaults to the first one |

Invite the bot to your Discord with the **applications.commands** scope (the
default bot invite from the developer portal works). It needs no privileged
intents and no special permissions.

## Run it anywhere else

```bash
npm install
DISCORD_TOKEN=... FADEHOST_TOKEN=... npm start
```

Node 18 or newer.
