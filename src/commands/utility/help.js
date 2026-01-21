const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    permission: 0,
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),

    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Max Commands')
            .setDescription(
                '> **Moderation**\n' +
                '`/ban` `/unban` `/mute` `/warn` `/warnlist`\n' +
                '`/modlog` `/purge` `/slowmode` `/nuke`\n' +
                '`/lock` `/unlock` `/lockall` `/unlockall`\n\n' +
                '> **Voice**\n' +
                '`/record` `/vcbansetup` `/vcban` `/vcunban`\n' +
                '`/vcbanlist` `/vcresetban` `/vcmuteall`\n' +
                '`/vcmuteoff`\n\n' +
                '> **Admin**\n' +
                '`/setstaff` `/prefix` `/sticky`\n' +
                '`/autoresponder` `/autoreact` `/autoroleuser`\n' +
                '`/autorolebot` `/automod` `/blacklist`\n' +
                '`/securechannel`\n\n' +
                '> **Utility**\n' +
                '`/help` `/invite` `/tempvcsetup`\n' +
                '`/ticketsetup` `/ticketpanel`\n\n' +
                '```Use ! prefix for text commands```'
            )
            .setColor(0x46F000)
            .setFooter({ text: 'Powered by ArcticNodes.io | Coded by Raze' });

        await interaction.reply({ embeds: [helpEmbed] });
    }
};
