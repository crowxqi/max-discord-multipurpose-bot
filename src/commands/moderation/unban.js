const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('The user ID to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const userId = interaction.options.getString('user', true).replace(/[<@!>]/g, '');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            // Fetch ban to verify user is banned
            const ban = await interaction.guild.bans.fetch(userId).catch(() => null);

            if (!ban) {
                return interaction.reply({
                    embeds: [embeds.error('Not Banned', 'This user is not banned from this server.')],
                    ephemeral: true
                });
            }

            const bannedUser = ban.user;

            // Unban the user
            await interaction.guild.members.unban(userId, `Unbanned by ${interaction.user.tag}: ${reason}`);

            // Log to database
            statements.addModlog.run(
                interaction.guildId,
                userId,
                interaction.user.id,
                'UNBAN',
                reason,
                null
            );

            // Create custom unban embed
            const unbanEmbed = new EmbedBuilder()
                .setTitle(`${bannedUser.tag} has been unbanned successfully`)
                .setDescription(`\`unban by\` : ${interaction.user.tag}\n\`unban reason\` : ${reason}`)
                .setColor(0x2A0000)
                .setFooter({
                    text: `unbanned ${bannedUser.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [unbanEmbed]
            });
        } catch (error) {
            console.error('Unban error:', error);
            await interaction.reply({
                embeds: [embeds.error('Unban Failed', 'Failed to unban the user. Make sure the ID is valid.')],
                ephemeral: true
            });
        }
    }
};
