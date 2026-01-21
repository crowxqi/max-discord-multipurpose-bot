const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('securechannel')
        .setDescription('Disable Use External Apps permission to prevent spam')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            let channelsSecured = 0;

            // Get all text channels
            const channels = guild.channels.cache.filter(c =>
                c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice
            );

            // Disable UseExternalApps for @everyone in all channels
            for (const [, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        UseExternalApps: false
                    });
                    channelsSecured++;
                } catch { }
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 channels secured')
                .setDescription(`\`channels\` : ${channelsSecured}\n\`permission\` : Use External Apps disabled`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Securechannel error:', error);
            await interaction.editReply({ content: 'Failed to secure channels.' });
        }
    }
};
