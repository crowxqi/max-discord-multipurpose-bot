const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('vcunban')
        .setDescription('Unban a user from voice channels')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to VC unban')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user', true);

        try {
            const guildData = statements.getGuild.get(interaction.guildId);

            if (!guildData?.vcban_role) {
                return interaction.reply({ content: 'VC ban not setup!', ephemeral: true });
            }

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }

            // Remove the vcban role
            await member.roles.remove(guildData.vcban_role);

            // Remove from database
            statements.removeVcban.run(interaction.guildId, target.id);

            const embed = new EmbedBuilder()
                .setTitle(`${target.tag} vc unbanned 🔊`)
                .setDescription(`\`by\` : ${interaction.user.tag}`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('VCUnban error:', error);
            await interaction.reply({ content: 'Failed to VC unban user.', ephemeral: true });
        }
    }
};
