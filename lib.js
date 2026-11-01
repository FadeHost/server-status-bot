// What the bot says about a server, kept apart from the Discord client so
// the tests can check it against the shape GET /api/servers really returns.

// Minecraft's default port is never typed, so leave it off.
function withPort(host, port) {
  return !port || Number(port) === 25565 ? host : `${host}:${port}`
}

// The address players type, in the order the panel shows it: the owner's
// own domain once its DNS checked out (the SRV record carries the port),
// the FadeHost subdomain, the server's FadeHost name such as
// ember.fadehost.gg (the API adds the port when the game needs one), the
// relayed address of a server on the owner's own node, and last the node
// with the port. `hostname` is an object, { subdomain, domain: { name } },
// or false; never a string.
function addressOf(server) {
  if (server.custom_domain && server.custom_domain_verified_at) return server.custom_domain

  const sub = server.hostname
  if (sub && sub.subdomain && sub.domain && sub.domain.name) return withPort(`${sub.subdomain}.${sub.domain.name}`, server.port)

  const name = server.address_name
  if (name && name.ready && name.address) return name.address

  if (server.node && server.node.is_byon && server.public_address) return server.public_address

  const host = server.node && (server.node.hostname || server.node.ip)
  return host ? withPort(host, server.port) : null
}

const STATES = {
  Online: { label: "Online", emoji: "🟢", color: 0x22c55e },
  Starting: { label: "Starting", emoji: "🟡", color: 0xf59e0b },
  Restarting: { label: "Restarting", emoji: "🟡", color: 0xf59e0b },
  Stopping: { label: "Stopping", emoji: "🟠", color: 0xf97316 },
  Stopped: { label: "Stopped", emoji: "⚫", color: 0x71717a },
  BackingUp: { label: "Backing up", emoji: "🟡", color: 0xf59e0b },
  Restoring: { label: "Restoring", emoji: "🟡", color: 0xf59e0b },
}

// A stopped server that FadeHost put to sleep is not off: it wakes by itself
// when somebody joins, and saying "stopped" sends players away. The API has
// no sleeping status; it says Stopped and sets hibernated_at.
function stateOf(server) {
  const status = String(server.status || "Unknown")
  if (status === "Stopped" && server.hibernated_at) {
    return { label: "Sleeping", emoji: "🌙", color: 0x818cf8, note: "wakes up when someone joins", online: false }
  }
  const known = STATES[status]
  if (known) return { ...known, note: null, online: status === "Online" }
  return { label: status, emoji: "⚪", color: 0x71717a, note: null, online: false }
}

module.exports = { addressOf, stateOf }
