#!/usr/bin/env node
// cli/bin/usersessions.mjs
//
// Usage:
//   npx @usersessions/cli connect              wire up the MCP server in your AI client
//   npx @usersessions/cli init [client-key]    print the capture-script snippet for your site

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import readline from "node:readline/promises";

const MCP_URL = "https://mcp.usersessions.io/mcp";

function claudeDesktopConfigPath() {
  const os = platform();
  if (os === "darwin") return join(homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  if (os === "win32") return join(process.env.APPDATA ?? "", "Claude/claude_desktop_config.json");
  return join(homedir(), ".config/Claude/claude_desktop_config.json");
}

function cursorConfigPath() {
  return join(homedir(), ".cursor/mcp.json");
}

function readJsonSafe(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function writeMcpEntry(configPath, apiKey) {
  mkdirSync(dirname(configPath), { recursive: true });
  const config = readJsonSafe(configPath);
  config.mcpServers ??= {};
  config.mcpServers.usersessions = {
    url: MCP_URL,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

async function promptApiKey() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const key = await rl.question("Paste your UserSessions.io API key (Settings > API Keys): ");
  rl.close();
  return key.trim();
}

async function cmdConnect() {
  const args = process.argv.slice(3);
  const clientFlag = args.find((a) => a.startsWith("--client="));
  const client = clientFlag ? clientFlag.split("=")[1] : null;

  const apiKey = process.env.USERSESSIONS_API_KEY || (await promptApiKey());
  if (!apiKey || !/^us_[0-9a-f]{64}$/.test(apiKey)) {
    console.error("That does not look like a UserSessions API key (expected us_ followed by 64 hex chars). Aborting.");
    process.exit(1);
  }

  const targets = [];
  if (!client || client === "claude") targets.push(["Claude Desktop", claudeDesktopConfigPath()]);
  if (!client || client === "cursor") targets.push(["Cursor", cursorConfigPath()]);

  for (const [name, path] of targets) {
    try {
      writeMcpEntry(path, apiKey);
      console.log(`Connected to ${name} (${path})`);
    } catch (err) {
      console.log(`Could not write config for ${name}: ${err.message}`);
    }
  }

  console.log("\nRestart your AI client for the connection to take effect.");
  console.log("Read-only tools work immediately. Write tools (approve/dismiss/create policy) need a key with the write:actions scope.");
}

function cmdInit() {
  const key = process.argv[3] ?? process.env.USERSESSIONS_CLIENT_KEY ?? "YOUR_PUBLIC_CLIENT_KEY";
  // capture.js reads data-client-key and is served from usersessions.io; the onboarding
  // verifier looks for exactly that host + key, so any other snippet never verifies.
  console.log(`
Add this to the <head> of every page on your site:

  <script async src="https://usersessions.io/capture.js" data-client-key="${key}"></script>

Your public client key is shown in the dashboard under Onboarding (or Settings > Connected site).
Pass it directly:  npx @usersessions/cli init <client-key>
`);
}

const cmd = process.argv[2];
if (cmd === "connect") await cmdConnect();
else if (cmd === "init") cmdInit();
else {
  console.log(`Usage:
  npx @usersessions/cli connect            Connect your AI client (Claude, Cursor) to your UserSessions.io data
  npx @usersessions/cli init [client-key]  Get your site's capture-script snippet`);
}
