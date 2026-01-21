const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const { clearGuildCache } = require('../../handlers/permissionHandler');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('setstaff')
        .setDescription('Manage staff roles and users')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a staff role or user')
                .addMentionableOption(option =>
                    option.setName('target')
                        .setDescription('Role or user to add as staff')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Permission level (1=Staff, 2=Admin)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Staff', value: 1 },
                            { name: 'Admin', value: 2 }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a staff role or user')
                .addMentionableOption(option =>
                    option.setName('target')
                        .setDescription('Role or user to remove from staff')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all staff roles and users'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const target = interaction.options.getMentionable('target', true);
            const level = interaction.options.getInteger('level') || 1;
            const levelName = level === 2 ? 'Admin' : 'Staff';

            try {
                if (target.user) {
                    statements.addStaffUser.run(interaction.guildId, target.id, level);
                    clearGuildCache(interaction.guildId);

                    const addEmbed = new EmbedBuilder()
                        .setTitle('staff added ✅')
                        .setDescription(`\`user\` : ${target}\n\`level\` : ${levelName}`)
                        .setColor(0x00FF00)
                        .setTimestamp();

                    await interaction.reply({ embeds: [addEmbed] });
                } else if (target.name) {
                    statements.addStaffRole.run(interaction.guildId, target.id, level);
                    clearGuildCache(interaction.guildId);

                    const addEmbed = new EmbedBuilder()
                        .setTitle('staff role added ✅')
                        .setDescription(`\`role\` : ${target}\n\`level\` : ${levelName}`)
                        .setColor(0x00FF00)
                        .setTimestamp();

                    await interaction.reply({ embeds: [addEmbed] });
                } else {
                    await interaction.reply({
                        embeds: [embeds.error('Invalid Target', 'Please mention a valid role or user.')],
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Setstaff add error:', error);
                await interaction.reply({
                    embeds: [embeds.error('Error', 'Failed to add staff.')],
                    ephemeral: true
                });
            }
        }

        else if (subcommand === 'remove') {
            const target = interaction.options.getMentionable('target', true);

            try {
                if (target.user) {
                    statements.removeStaffUser.run(interaction.guildId, target.id);
                    clearGuildCache(interaction.guildId);

                    const removeEmbed = new EmbedBuilder()
                        .setTitle('staff removed ❌')
                        .setDescription(`\`user\` : ${target}`)
                        .setColor(0xFF0000)
                        .setTimestamp();

                    await interaction.reply({ embeds: [removeEmbed] });
                } else if (target.name) {
                    statements.removeStaffRole.run(interaction.guildId, target.id);
                    clearGuildCache(interaction.guildId);

                    const removeEmbed = new EmbedBuilder()
                        .setTitle('staff role removed ❌')
                        .setDescription(`\`role\` : ${target}`)
                        .setColor(0xFF0000)
                        .setTimestamp();

                    await interaction.reply({ embeds: [removeEmbed] });
                } else {
                    await interaction.reply({
                        embeds: [embeds.error('Invalid Target', 'Please mention a valid role or user.')],
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Setstaff remove error:', error);
                await interaction.reply({
                    embeds: [embeds.error('Error', 'Failed to remove staff.')],
                    ephemeral: true
                });
            }
        }

        else if (subcommand === 'list') {
            try {
                const staffRoles = statements.getStaffRoles.all(interaction.guildId);
                const staffUsers = statements.getStaffUsers.all(interaction.guildId);

                let rolesText = staffRoles.length > 0
                    ? staffRoles.map(r => `<@&${r.role_id}> - ${r.permission_level === 2 ? 'Admin' : 'Staff'}`).join('\n')
                    : 'None';

                let usersText = staffUsers.length > 0
                    ? staffUsers.map(u => `<@${u.user_id}> - ${u.permission_level === 2 ? 'Admin' : 'Staff'}`).join('\n')
                    : 'None';

                const listEmbed = new EmbedBuilder()
                    .setTitle('📋 staff list')
                    .setDescription(`**Roles:**\n${rolesText}\n\n**Users:**\n${usersText}`)
                    .setColor(0x5865F2)
                    .setTimestamp();

                await interaction.reply({ embeds: [listEmbed], ephemeral: true });
            } catch (error) {
                console.error('Setstaff list error:', error);
                await interaction.reply({
                    embeds: [embeds.error('Error', 'Failed to list staff.')],
                    ephemeral: true
                });
            }
        }
    }
};
