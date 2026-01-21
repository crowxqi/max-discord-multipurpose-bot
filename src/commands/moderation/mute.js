const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

// Parse duration string to milliseconds
function parseDuration(str) {
    if (!str) return null;

    const match = str.match(/^(\d+)(s|m|h|d|w)?$/i);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = (match[2] || 'm').toLowerCase();

    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000
    };

    return num * multipliers[unit];
}

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user (alias for timeout)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g., 10m, 1h, 1d)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user', true);
        const durationStr = interaction.options.getString('duration') || '10m';
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const duration = parseDuration(durationStr);
        if (!duration) {
            return interaction.reply({
                embeds: [embeds.error('Invalid Duration', 'Please provide a valid duration (e.g., 10m, 1h, 1d)')],
                ephemeral: true
            });
        }

        if (duration > 28 * 24 * 60 * 60 * 1000) {
            return interaction.reply({
                embeds: [embeds.error('Duration Too Long', 'Maximum mute duration is 28 days.')],
                ephemeral: true
            });
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                embeds: [embeds.error('User Not Found', 'Could not find this user in the server.')],
                ephemeral: true
            });
        }

        if (!member.moderatable) {
            return interaction.reply({
                embeds: [embeds.error('Cannot Mute', 'I cannot mute this user. They may have higher permissions than me.')],
                ephemeral: true
            });
        }

        if (interaction.member.roles.highest.position <= member.roles.highest.position) {
            return interaction.reply({
                embeds: [embeds.error('Cannot Mute', 'You cannot mute a user with equal or higher roles.')],
                ephemeral: true
            });
        }

        try {
            await member.timeout(duration, `${interaction.user.tag}: ${reason}`);

            statements.addModlog.run(
                interaction.guildId,
                target.id,
                interaction.user.id,
                'MUTE',
                reason,
                durationStr
            );

            // Create custom mute embed
            const muteEmbed = new EmbedBuilder()
                .setTitle(`${target.tag} got muted for ${durationStr}`)
                .setDescription(`\`mute reason\` : ${reason}`)
                .setColor(0xFF0000)
                .setFooter({
                    text: `${target.tag} was muted`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [muteEmbed]
            });
        } catch (error) {
            console.error('Mute error:', error);
            await interaction.reply({
                embeds: [embeds.error('Mute Failed', 'Failed to mute the user.')],
                ephemeral: true
            });
        }
    }
};
