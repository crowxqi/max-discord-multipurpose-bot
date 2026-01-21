const { statements } = require('../database/db');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        // User joined or moved to a voice channel
        if (newState.channelId && !newState.member.user.bot) {
            // 1. Check for VC Ban
            const vcBan = statements.getVcban.get(newState.guild.id, newState.member.id);
            const guildData = statements.getGuild.get(newState.guild.id);
            const isRoleBanned = guildData?.vcban_role && newState.member.roles.cache.has(guildData.vcban_role);

            if (vcBan || isRoleBanned) {
                // Determine reason
                const reason = vcBan?.reason || 'VC Banned';

                // Force disconnect
                try {
                    await newState.disconnect(`VC Ban: ${reason}`);

                    // Re-apply role if missing (security fallback)
                    if (guildData?.vcban_role && !isRoleBanned) {
                        await newState.member.roles.add(guildData.vcban_role).catch(() => { });
                    }
                } catch (e) {
                    console.error('Failed to enforce VC ban:', e);
                }
                return; // Stop processing (don't check for mute if they are getting kicked)
            }

            // 2. Check for VC Mute
            const muted = statements.getVcmuteChannel.get(newState.channelId);
            if (muted) {
                newState.setMute(true).catch(() => { });
            }

            // 3. TEMP VC: Join to Create (ULTRA FAST)
            const tempSettings = statements.getTempVcSettings.get(newState.guild.id);
            if (tempSettings && newState.channelId === tempSettings.join_channel_id) {
                // Create channel with minimal options for speed (use display name)
                const displayName = newState.member.displayName || newState.member.user.globalName || newState.member.user.username;
                const newChannel = await newState.guild.channels.create({
                    name: `${displayName}'s VC`,
                    type: 2,
                    parent: tempSettings.category_id,
                    permissionOverwrites: [
                        { id: newState.guild.id, allow: ['Connect'] },
                        { id: newState.member.id, allow: ['Connect', 'ManageChannels', 'MoveMembers'] }
                    ]
                }).catch(() => null);

                if (newChannel) {
                    // Move member and save to DB in parallel for speed
                    newState.setChannel(newChannel).catch(() => { });
                    statements.addActiveTempVc.run(newChannel.id, newState.guild.id, newState.member.id);
                }
            }
        }

        // User left a channel (cleanup)
        if (oldState.channelId) {
            // Check if it's an active temp VC
            const activeVc = statements.getActiveTempVc.get(oldState.channelId);
            if (activeVc) {
                try {
                    // Try to get the channel (may need to fetch if not cached)
                    let channel = oldState.channel;
                    if (!channel) {
                        channel = await oldState.guild.channels.fetch(oldState.channelId).catch(() => null);
                    }

                    // If channel doesn't exist anymore, just clean up DB
                    if (!channel) {
                        statements.removeActiveTempVc.run(oldState.channelId);
                        return;
                    }

                    // If empty, delete it
                    if (channel.members.size === 0) {
                        await channel.delete().catch(() => { });
                        statements.removeActiveTempVc.run(oldState.channelId);
                    }
                } catch (e) {
                    // Clean up DB entry regardless
                    if (e.code === 10003) { // Unknown Channel
                        statements.removeActiveTempVc.run(oldState.channelId);
                    } else {
                        console.error('TempVC Delete Error:', e);
                    }
                }
            }
        }
    }
};
