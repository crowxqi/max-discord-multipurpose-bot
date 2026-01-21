const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel (prevent sending messages)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to lock (defaults to current)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            await channel.permissionOverwrites.edit(interaction.guild.id, {
                SendMessages: false
            });

            const embed = new EmbedBuilder()
                .setTitle('Channel Locked 🔒')
                .setDescription(`Successfully locked ${channel}`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Lock error:', error);
            await interaction.reply({ content: 'Failed to lock channel. Check my permissions.', ephemeral: true });
        }
    }
};
