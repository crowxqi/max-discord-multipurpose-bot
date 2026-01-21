const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const config = require('../../config');

// Parse duration string to seconds
function parseDuration(str) {
    if (!str) return null;

    const match = str.match(/^(\d+)(s|m|h)?$/i);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = (match[2] || 's').toLowerCase();

    const multipliers = {
        's': 1,
        'm': 60,
        'h': 3600
    };

    return num * multipliers[unit];
}

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set channel slowmode')
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Slowmode duration (e.g., 5s, 1m, 1h) or 0 to disable')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const durationStr = interaction.options.getString('duration', true);

        // Handle disable
        if (durationStr === '0' || durationStr.toLowerCase() === 'off') {
            try {
                await interaction.channel.setRateLimitPerUser(0);

                const disableEmbed = new EmbedBuilder()
                    .setTitle('slowmode set to 0s 🕑')
                    .setColor(0x00FF70)
                    .setTimestamp();

                return interaction.reply({
                    embeds: [disableEmbed]
                });
            } catch (error) {
                return interaction.reply({
                    embeds: [embeds.error('Error', 'Failed to disable slowmode.')],
                    ephemeral: true
                });
            }
        }

        const duration = parseDuration(durationStr);

        if (duration === null) {
            return interaction.reply({
                embeds: [embeds.error('Invalid Duration', 'Please provide a valid duration (e.g., 5s, 1m, 1h) or 0 to disable.')],
                ephemeral: true
            });
        }

        // Max slowmode is 6 hours (21600 seconds)
        if (duration > 21600) {
            return interaction.reply({
                embeds: [embeds.error('Duration Too Long', 'Maximum slowmode duration is 6 hours.')],
                ephemeral: true
            });
        }

        try {
            await interaction.channel.setRateLimitPerUser(duration);

            // Create custom slowmode embed
            const slowmodeEmbed = new EmbedBuilder()
                .setTitle(`slowmode set to ${duration}s 🕑`)
                .setColor(0x00FF70)
                .setTimestamp();

            await interaction.reply({
                embeds: [slowmodeEmbed]
            });
        } catch (error) {
            console.error('Slowmode error:', error);
            await interaction.reply({
                embeds: [embeds.error('Error', 'Failed to set slowmode.')],
                ephemeral: true
            });
        }
    }
};
