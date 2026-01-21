const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('Set the command prefix for this server')
        .addStringOption(option =>
            option.setName('prefix')
                .setDescription('The new prefix (e.g., !, ?, .)')
                .setRequired(true)
                .setMaxLength(5))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const newPrefix = interaction.options.getString('prefix', true);

        if (newPrefix.includes(' ')) {
            return interaction.reply({
                embeds: [embeds.error('Invalid Prefix', 'Prefix cannot contain spaces.')],
                ephemeral: true
            });
        }

        try {
            let guildData = statements.getGuild.get(interaction.guildId);
            if (!guildData) {
                statements.upsertGuild.run(interaction.guildId, newPrefix, null, null, null);
            } else {
                statements.upsertGuild.run(
                    interaction.guildId,
                    newPrefix,
                    guildData.panel_url,
                    guildData.server_ip,
                    guildData.store_url
                );
            }

            const prefixEmbed = new EmbedBuilder()
                .setTitle('prefix updated ⚙️')
                .setDescription(`\`new prefix\` : ${newPrefix}\n\`example\` : ${newPrefix}help`)
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({
                embeds: [prefixEmbed]
            });
        } catch (error) {
            console.error('Prefix error:', error);
            await interaction.reply({
                embeds: [embeds.error('Error', 'Failed to update prefix.')],
                ephemeral: true
            });
        }
    }
};
