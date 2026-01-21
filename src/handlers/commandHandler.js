const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes } = require('discord.js');
const config = require('../config');

/**
 * Load all commands from the commands directory
 */
function loadCommands(client) {
    client.commands = new Collection();
    client.slashCommands = [];

    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const stat = fs.statSync(folderPath);

        if (stat.isDirectory()) {
            console.log(`📂 Loading folder: ${folder}`);
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);

                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    client.slashCommands.push(command.data.toJSON());
                    console.log(`✅ Loaded command: ${command.data.name}`);
                } else {
                    console.log(`⚠️ Command at ${filePath} is missing required properties`);
                }
            }
        }
    }

    console.log(`📦 Loaded ${client.commands.size} commands`);
}

/**
 * Register slash commands with Discord
 */
async function registerSlashCommands(client) {
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
        console.log('🔄 Registering slash commands...');

        // Register globally
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: client.slashCommands }
        );
        console.log('✅ Successfully registered slash commands globally');

        // Clear guild-specific commands to prevent duplicates (Global commands take priority)
        const guilds = client.guilds.cache.map(guild => guild.id);
        for (const guildId of guilds) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, guildId),
                    { body: [] }
                );
                console.log(`🗑️ Cleared local commands for guild: ${guildId}`);
            } catch (error) {
                console.error(`❌ Failed to clear commands for guild ${guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('❌ Error registering slash commands:', error);
    }
}

module.exports = {
    loadCommands,
    registerSlashCommands
};
