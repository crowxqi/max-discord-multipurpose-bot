const { loadCommands, registerSlashCommands } = require('../handlers/commandHandler');
const { statements } = require('../database/db');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 Powered by ArcticNodes.io | Coded by Raze');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🤖 ${client.user.tag} is online!`);
        console.log(`📊 Serving ${client.guilds.cache.size} servers`);
        console.log(`👥 Watching ${client.users.cache.size} users`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Load commands
        loadCommands(client);

        // Register slash commands
        await registerSlashCommands(client);

        // Set bot status
        client.user.setPresence({
            activities: [{ name: 'ArcticNodes | /help', type: 3 }], // Watching
            status: 'online'
        });

        // Cleanup orphaned temp VCs (from bot restarts)
        try {
            const allTempVcs = statements.getAllActiveTempVcs?.all() || [];
            let cleaned = 0;
            for (const vc of allTempVcs) {
                try {
                    const guild = client.guilds.cache.get(vc.guild_id);
                    if (!guild) {
                        statements.removeActiveTempVc.run(vc.channel_id);
                        cleaned++;
                        continue;
                    }
                    const channel = await guild.channels.fetch(vc.channel_id).catch(() => null);
                    if (!channel) {
                        statements.removeActiveTempVc.run(vc.channel_id);
                        cleaned++;
                        continue;
                    }
                    // Delete if empty
                    if (channel.members.size === 0) {
                        await channel.delete().catch(() => { });
                        statements.removeActiveTempVc.run(vc.channel_id);
                        cleaned++;
                    }
                } catch (e) {
                    statements.removeActiveTempVc.run(vc.channel_id);
                    cleaned++;
                }
            }
            if (cleaned > 0) console.log(`🧹 Cleaned up ${cleaned} orphaned temp VC(s)`);
        } catch (e) {
            // getAllActiveTempVcs might not exist, that's ok
        }
    }
};
