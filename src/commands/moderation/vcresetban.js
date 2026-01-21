const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('vcresetban')
        .setDescription('Reset all VC bans')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildData = statements.getGuild.get(interaction.guildId);

            if (!guildData?.vcban_role) {
                return interaction.editReply({ content: 'VC ban not setup!' });
            }

            const vcbans = statements.getVcbans.all(interaction.guildId);
            let unbanned = 0;

            for (const ban of vcbans) {
                try {
                    const member = await interaction.guild.members.fetch(ban.user_id).catch(() => null);
                    if (member) {
                        await member.roles.remove(guildData.vcban_role);
                        unbanned++;
                    }
                } catch { }
            }

            // Clear all from database
            statements.clearVcbans.run(interaction.guildId);

            const embed = new EmbedBuilder()
                .setTitle('vcban reset 🔄')
                .setDescription(`\`unbanned\` : ${unbanned} users`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('VCResetBan error:', error);
            await interaction.editReply({ content: 'Failed to reset VC bans.' });
        }
    }
};
