const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('autorolebot')
        .setDescription('Set auto role for new bots')
        .addRoleOption(opt =>
            opt.setName('role')
                .setDescription('The role to give new bots (leave empty to disable)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const role = interaction.options.getRole('role');

        if (!role) {
            statements.setAutoroleBot.run(interaction.guildId, null);

            const embed = new EmbedBuilder()
                .setTitle('autorole bot disabled ❌')
                .setColor(0xFF0000)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        statements.setAutoroleBot.run(interaction.guildId, role.id);

        const embed = new EmbedBuilder()
            .setTitle('autorole bot set ✅')
            .setDescription(`\`role\` : ${role}`)
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
