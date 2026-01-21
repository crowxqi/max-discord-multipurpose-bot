const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Delete and recreate the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            const channel = interaction.channel;
            const position = channel.position;
            const parent = channel.parent;

            // Clone the channel
            const newChannel = await channel.clone({
                reason: `Nuked by ${interaction.user.tag}`
            });

            // Set position
            await newChannel.setPosition(position);

            // Delete old channel
            await channel.delete();

            // Send confirmation in new channel
            const embed = new EmbedBuilder()
                .setTitle('💣 channel nuked')
                .setDescription(`\`by\` : ${interaction.user.tag}`)
                .setColor(0xFF0000)
                .setImage('https://media.giphy.com/media/HhTXt43pk1I1W/giphy.gif')
                .setTimestamp();

            await newChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Nuke error:', error);
            await interaction.reply({ content: 'Failed to nuke channel.', ephemeral: true });
        }
    }
};
