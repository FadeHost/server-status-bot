// FadeHost Server Status Bot
//
// Shows your FadeHost game server inside Discord: live status and player
// count in the bot's presence, /status /players /ip for everyone, and
// /start /stop /restart for members with Manage Server.
//
// Configuration (environment variables, set in the FadeHost panel):
//   DISCORD_TOKEN   your Discord bot token (discord.com/developers)
//   FADEHOST_TOKEN  a FadeHost AI-access token with the "manage" scope
//                   (laplace.fadehost.com/profile/ai-access)
//   SERVER_ID       optional server_... id; defaults to your first server

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  REST,
  Routes,
} = require("discord.js")

const API = "https://api.fadehost.com/api"

// ---- configuration checks with human answers, not stack traces ----------

function fatal(message) {
  console.error(`[config] ${message}`)
  process.exit(1)
}

const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || "").trim()
const FADEHOST_TOKEN = (process.env.FADEHOST_TOKEN || "").trim()
const SERVER_ID = (process.env.SERVER_ID || "").trim()

if (!DISCORD_TOKEN) {
  fatal(
    "DISCORD_TOKEN is not set. Create a bot at discord.com/developers (New Application → Bot → Reset Token), then add the token under Environment variables in your FadeHost panel and restart."
  )
}
if (!FADEHOST_TOKEN) {
  fatal(
    "FADEHOST_TOKEN is not set. Create a token with the manage scope at laplace.fadehost.com/profile/ai-access, then add it under Environment variables and restart."
  )
}

// ---- FadeHost API client -------------------------------------------------

async function api(method, path, expectJson = true) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${FADEHOST_TOKEN}`,
      Accept: "application/json",
    },
  })

  if (res.status === 401) {
    throw new Error(
      "FadeHost rejected the token — it may have been revoked. Mint a new one at laplace.fadehost.com/profile/ai-access."
    )
  }
  if (res.status === 402) {
    throw new Error("The server's subscription is not active, so this action is blocked.")
  }
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body.message || body.error || ""
    } catch {}
    throw new Error(detail || `FadeHost API answered ${res.status}.`)
  }

  return expectJson ? res.json() : null
}

async function resolveServer() {
  const servers = await api("GET", "/servers")
  if (!Array.isArray(servers) || servers.length === 0) {
    throw new Error("No servers on this FadeHost account yet.")
  }
  if (SERVER_ID) {
    const match = servers.find((s) => s.prefixed_id === SERVER_ID)
    if (!match) {
      throw new Error(
        `SERVER_ID ${SERVER_ID} was not found on this account. Valid ids: ${servers.map((s) => s.prefixed_id).join(", ")}`
      )
    }
    return match
  }
  return servers[0]
}

function addressOf(server) {
  if (!server.hostname) return null
  return server.port === 25565 ? server.hostname : `${server.hostname}:${server.port}`
}

const STATUS_META = {
  Online: { emoji: "🟢", color: 0x22c55e },
  Starting: { emoji: "🟡", color: 0xf59e0b },
  Restarting: { emoji: "🟡", color: 0xf59e0b },
  Hibernating: { emoji: "🌙", color: 0x818cf8 },
  Stopping: { emoji: "🟠", color: 0xf97316 },
  Stopped: { emoji: "⚫", color: 0x71717a },
}

function meta(status) {
  return STATUS_META[status] || { emoji: "⚪", color: 0x71717a }
}

// ---- Discord client ------------------------------------------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const commands = [
  new SlashCommandBuilder().setName("status").setDescription("Live status of the game server"),
  new SlashCommandBuilder().setName("players").setDescription("Who is online right now"),
  new SlashCommandBuilder().setName("ip").setDescription("The address to join the server"),
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the server (the world is saved first)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("restart")
    .setDescription("Restart the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON())

async function updatePresence() {
  try {
    const server = await resolveServer()
    const online = server.status === "Online"
    const count = server.onlinePlayerCount ?? 0
    client.user.setPresence({
      activities: [
        {
          type: ActivityType.Watching,
          name: online
            ? `${count} ${count === 1 ? "player" : "players"} on ${server.name}`
            : `${server.name} · ${server.status.toLowerCase()}`,
        },
      ],
      status: online ? "online" : "idle",
    })
  } catch (error) {
    console.error(`[presence] ${error.message}`)
  }
}

client.once("clientReady", async () => {
  console.log(`[ready] Logged in as ${client.user.tag}`)

  try {
    const server = await resolveServer()
    console.log(`[ready] Watching ${server.name} (${server.prefixed_id})`)
  } catch (error) {
    console.error(`[config] ${error.message}`)
  }

  const rest = new REST().setToken(DISCORD_TOKEN)
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands })
  console.log("[ready] Slash commands registered — they can take a minute to appear.")

  updatePresence()
  setInterval(updatePresence, 60_000)
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  await interaction.deferReply()

  try {
    const server = await resolveServer()
    const address = addressOf(server)
    const m = meta(server.status)

    switch (interaction.commandName) {
      case "status": {
        const embed = new EmbedBuilder()
          .setTitle(`${m.emoji} ${server.name}`)
          .setColor(m.color)
          .addFields(
            { name: "Status", value: server.status, inline: true },
            {
              name: "Players",
              value: `${server.onlinePlayerCount ?? 0}${server.slots ? ` / ${server.slots}` : ""}`,
              inline: true,
            },
            ...(address ? [{ name: "Address", value: `\`${address}\``, inline: true }] : [])
          )
          .setFooter({ text: "Hosted on FadeHost" })
        await interaction.editReply({ embeds: [embed] })
        break
      }

      case "players": {
        const names = Array.isArray(server.players_sample) ? server.players_sample : []
        if (server.status !== "Online") {
          await interaction.editReply(`${m.emoji} ${server.name} is ${server.status.toLowerCase()} right now.`)
        } else if ((server.onlinePlayerCount ?? 0) === 0) {
          await interaction.editReply(`Nobody on ${server.name} right now — be the first!`)
        } else {
          const extra = (server.onlinePlayerCount ?? 0) - names.length
          await interaction.editReply(
            `**${server.onlinePlayerCount}** online: ${names.map((n) => `\`${n}\``).join(", ")}${extra > 0 ? ` and ${extra} more` : ""}`
          )
        }
        break
      }

      case "ip": {
        await interaction.editReply(
          address ? `Join **${server.name}** at \`${address}\`` : "This server has no public address configured."
        )
        break
      }

      case "start":
      case "stop":
      case "restart": {
        await api("POST", `/servers/${server.prefixed_id}/${interaction.commandName}`, false)
        const verb = { start: "Starting", stop: "Stopping", restart: "Restarting" }[interaction.commandName]
        await interaction.editReply(`${verb} **${server.name}**…`)
        setTimeout(updatePresence, 10_000)
        break
      }
    }
  } catch (error) {
    console.error(`[command:${interaction.commandName}] ${error.message}`)
    await interaction.editReply(`⚠️ ${error.message}`)
  }
})

client.on("error", (error) => console.error(`[discord] ${error.message}`))

// Check the FadeHost side FIRST so a bad token of either kind fails fast
// with a message that says exactly what to fix.
async function boot() {
  try {
    const server = await resolveServer()
    console.log(`[startup] FadeHost token OK — watching ${server.name} (${server.prefixed_id})`)
  } catch (error) {
    fatal(error.message)
  }

  client.login(DISCORD_TOKEN).catch((error) => {
    if (String(error).includes("TOKEN_INVALID") || String(error.code) === "TokenInvalid") {
      fatal(
        "Discord rejected DISCORD_TOKEN. Reset the token at discord.com/developers → your app → Bot → Reset Token, update the Environment variable and restart."
      )
    }
    fatal(`Could not log in to Discord: ${error.message}`)
  })
}

boot()
