const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('autoroleuser')
        .setDescription('Set auto role for new users')
        .addRoleOption(opt =>
            opt.setName('role')
                .setDescription('The role to give new users (leave empty to disable)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const role = interaction.options.getRole('role');

        if (!role) {
            // Disable autorole
            statements.setAutoroleUser.run(interaction.guildId, null);

            const embed = new EmbedBuilder()
                .setTitle('autorole user disabled ❌')
                .setColor(0xFF0000)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        statements.setAutoroleUser.run(interaction.guildId, role.id);

        const embed = new EmbedBuilder()
            .setTitle('autorole user set ✅')
            .setDescription(`\`role\` : ${role}`)
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
