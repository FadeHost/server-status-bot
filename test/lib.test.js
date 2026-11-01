// The server entries below have the shape GET /api/servers returns: hostname
// is an object or false, address_name carries the server's FadeHost name,
// and a sleeping server is Stopped with hibernated_at set.
const test = require("node:test")
const assert = require("node:assert/strict")
const { addressOf, stateOf } = require("../lib")

const server = (overrides = {}) => ({
  name: "Emberfell",
  status: "Online",
  hibernated_at: null,
  port: 26010,
  hostname: false,
  custom_domain: null,
  custom_domain_verified_at: null,
  address_name: { name: "ember", address: "ember.fadehost.gg", ready: true },
  node: { hostname: "alpha.fadehost.net", ip: "203.0.113.7", is_byon: false },
  public_address: null,
  ...overrides,
})

test("the server's FadeHost name is the address when there is no domain or subdomain", () => {
  assert.equal(addressOf(server()), "ember.fadehost.gg")
})

test("a FadeHost subdomain is a name, not [object Object], with the port unless it is 25565", () => {
  const subdomain = { subdomain: "ember", domain: { name: "mc-play.net", uuid: "domain_1" } }
  assert.equal(addressOf(server({ hostname: subdomain })), "ember.mc-play.net:26010")
  assert.equal(addressOf(server({ hostname: subdomain, port: 25565 })), "ember.mc-play.net")
})

test("the owner's own domain wins once it is verified", () => {
  assert.equal(addressOf(server({ custom_domain: "play.ember.gg", custom_domain_verified_at: "2026-10-01T10:00:00Z" })), "play.ember.gg")
  assert.equal(addressOf(server({ custom_domain: "play.ember.gg" })), "ember.fadehost.gg")
})

test("a FadeHost name whose records are not up yet is skipped", () => {
  assert.equal(addressOf(server({ address_name: { address: "ember.fadehost.gg", ready: false } })), "alpha.fadehost.net:26010")
  assert.equal(addressOf(server({ address_name: null })), "alpha.fadehost.net:26010")
})

test("a server on the owner's own node uses its relayed address", () => {
  assert.equal(addressOf(server({ address_name: null, node: { is_byon: true }, public_address: "na1.play.fadehost.gg:30001" })), "na1.play.fadehost.gg:30001")
})

test("a stopped server that is asleep says so", () => {
  const sleeping = stateOf(server({ status: "Stopped", hibernated_at: "2026-11-01T09:00:00Z" }))
  assert.equal(sleeping.label, "Sleeping")
  assert.equal(sleeping.note, "wakes up when someone joins")
  assert.equal(sleeping.online, false)
  assert.equal(stateOf(server({ status: "Stopped" })).label, "Stopped")
})

test("every status the API sends has a label", () => {
  assert.equal(stateOf(server()).online, true)
  assert.equal(stateOf(server({ status: "BackingUp" })).label, "Backing up")
  assert.equal(stateOf(server({ status: "Restoring" })).label, "Restoring")
  assert.equal(stateOf(server({ status: false })).label, "Unknown")
})
