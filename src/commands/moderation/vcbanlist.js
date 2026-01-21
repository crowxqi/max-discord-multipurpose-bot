const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('vcbanlist')
        .setDescription('List all VC banned users')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

    async execute(interaction) {
        try {
            const vcbans = statements.getVcbans.all(interaction.guildId);

            const list = vcbans.length > 0
                ? vcbans.map((b, i) => `${i + 1}. <@${b.user_id}> - ${b.reason || 'No reason'}`).join('\n')
                : 'No VC bans.';

            const embed = new EmbedBuilder()
                .setTitle('📋 vcban list')
                .setDescription(list)
                .setColor(0x5865F2)
                .setFooter({ text: `Total: ${vcbans.length}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('VCBanList error:', error);
            await interaction.reply({ content: 'Failed to get VC ban list.', ephemeral: true });
        }
    }
};
