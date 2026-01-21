const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('modlog')
        .setDescription('View moderation history')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user', true);

        try {
            // Get accurate counts
            const counts = statements.getModlogCounts.all(interaction.guildId, target.id);

            let banCount = 0;
            let muteCount = 0;
            let warnCount = 0;
            let kickCount = 0;

            for (const c of counts) {
                if (c.action === 'BAN') banCount = c.count;
                else if (c.action === 'MUTE') muteCount = c.count;
                else if (c.action === 'WARN') warnCount = c.count;
                else if (c.action === 'KICK') kickCount = c.count;
            }

            // Get recent logs for display
            const logs = statements.getModlogs.all(interaction.guildId, target.id);

            const recentHistory = logs.length > 0 ? logs.map((log, i) => {
                const date = Math.floor(new Date(log.created_at).getTime() / 1000);
                const emoji = log.action === 'BAN' ? '🔨' : log.action === 'MUTE' ? '🔇' : log.action === 'WARN' ? '⚠️' : '🛡️';
                return `\`${i + 1}\` ${emoji} **${log.action}** • ${log.reason || 'No reason'} • <t:${date}:R>`;
            }).join('\n') : 'No recent history.';

            // Create custom modlog embed
            const modlogEmbed = new EmbedBuilder()
                .setTitle(`${target.tag} log`)
                .setDescription(`**History Stats:**\n\`has banned\` : ${banCount}\n\`has muted\` : ${muteCount}\n\`has warned\` : ${warnCount}\n\n**Recent Actions:**\n${recentHistory}`)
                .setColor(0xFF0000)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `User ID: ${target.id}` })
                .setTimestamp();

            await interaction.reply({
                embeds: [modlogEmbed]
            });
        } catch (error) {
            console.error('Modlog error:', error);
            await interaction.reply({
                embeds: [embeds.error('Error', 'Failed to fetch moderation logs.')],
                ephemeral: true
            });
        }
    }
};
