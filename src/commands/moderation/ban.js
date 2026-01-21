const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Ban duration (e.g., 7d, permanent)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const duration = interaction.options.getString('duration') || 'Permanent';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        // Check if user exists and is bannable
        if (member) {
            if (!member.bannable) {
                return interaction.reply({
                    embeds: [embeds.error('Cannot Ban', 'I cannot ban this user. They may have higher permissions than me.')],
                    ephemeral: true
                });
            }

            // Prevent banning users with higher roles
            if (interaction.member.roles.highest.position <= member.roles.highest.position) {
                return interaction.reply({
                    embeds: [embeds.error('Cannot Ban', 'You cannot ban a user with equal or higher roles.')],
                    ephemeral: true
                });
            }
        }

        try {
            // Ban the user
            await interaction.guild.members.ban(target.id, { reason: `${interaction.user.tag}: ${reason}` });

            // Log to database
            statements.addModlog.run(
                interaction.guildId,
                target.id,
                interaction.user.id,
                'BAN',
                reason,
                duration
            );

            // Create custom ban embed
            const banEmbed = new EmbedBuilder()
                .setTitle(`${target.tag} has been banned successfully`)
                .setDescription(`\`ban reason\` : ${reason}\n\`ban duration\` : ${duration}\n\`banned by\` : ${interaction.user.tag}`)
                .setColor(0xFF0000)
                .setFooter({
                    text: `banned ${target.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [banEmbed]
            });
        } catch (error) {
            console.error('Ban error:', error);
            await interaction.reply({
                embeds: [embeds.error('Ban Failed', 'Failed to ban the user.')],
                ephemeral: true
            });
        }
    }
};
