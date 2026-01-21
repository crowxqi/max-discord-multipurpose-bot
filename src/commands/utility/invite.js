const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: null, // Public command
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get the bot\'s invite link'),

    async execute(interaction) {
        const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=8&scope=bot%20applications.commands`;

        const embed = new EmbedBuilder()
            .setTitle('Invite Me! 🤖')
            .setDescription(`Click below to invite me to your server or join the support server.\n\n🔗 **[Invite Bot](${inviteUrl})**\n🆘 **[Support Server](https://discord.gg/your-support-server)**`)
            .setColor(0x0099FF)
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: 'Thanks for using our bot!' });

        await interaction.reply({ embeds: [embed] });
    }
};
