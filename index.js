// Main Discord bot file
require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { registerCommands, handleCommands, handleButtons, handleModals } = require('./src/commands');
const http = require('http');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

// Register slash commands when bot starts
client.once('ready', async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  await registerCommands(client);
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    await handleCommands(interaction);
  } else if (interaction.isButton()) {
    await handleButtons(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModals(interaction);
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// Create a simple HTTP server to satisfy Render's port binding requirement
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Nocena Discord Bot is running!');
});

server.listen(PORT, () => {
  console.log(`HTTP server is running on port ${PORT}`);
});