const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel (allow sending messages)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to unlock (defaults to current)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            await channel.permissionOverwrites.edit(interaction.guild.id, {
                SendMessages: true
            });

            const embed = new EmbedBuilder()
                .setTitle('Channel Unlocked 🔓')
                .setDescription(`Successfully unlocked ${channel}`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Unlock error:', error);
            await interaction.reply({ content: 'Failed to unlock channel. Check my permissions.', ephemeral: true });
        }
    }
};
