const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('vcbansetup')
        .setDescription('Setup VC ban system (creates vcban role)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Check if role already exists
            const guildData = statements.getGuild.get(interaction.guildId);
            if (guildData?.vcban_role) {
                const existingRole = interaction.guild.roles.cache.get(guildData.vcban_role);
                if (existingRole) {
                    const embed = new EmbedBuilder()
                        .setTitle('vcban already setup ⚠️')
                        .setDescription(`\`role\` : ${existingRole}`)
                        .setColor(0xFFAA00)
                        .setTimestamp();
                    return interaction.editReply({ embeds: [embed] });
                }
            }

            // Create the vcban role with NO permissions
            const vcbanRole = await interaction.guild.roles.create({
                name: 'VC Banned',
                color: 0xFF0000,
                permissions: [],
                reason: 'VC Ban system setup'
            });

            // Deny connect permission in all voice channels
            const voiceChannels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());
            for (const [, channel] of voiceChannels) {
                try {
                    await channel.permissionOverwrites.edit(vcbanRole, {
                        Connect: false
                    });
                } catch { }
            }

            // Save to database
            statements.setVcbanRole.run(interaction.guildId, vcbanRole.id);

            const embed = new EmbedBuilder()
                .setTitle('vcban setup complete ✅')
                .setDescription(`\`role\` : ${vcbanRole}\n\`channels\` : ${voiceChannels.size} configured`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('VCBan setup error:', error);
            await interaction.editReply({ content: 'Failed to setup VC ban system.' });
        }
    }
};
