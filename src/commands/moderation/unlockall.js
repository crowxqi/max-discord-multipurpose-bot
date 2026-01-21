const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('unlockall')
        .setDescription('Unlock the entire server (show all channels)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            let unlocked = 0;

            const channels = guild.channels.cache.filter(c =>
                c.type === ChannelType.GuildText ||
                c.type === ChannelType.GuildVoice ||
                c.type === ChannelType.GuildCategory
            );

            for (const [, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        ViewChannel: null // Reset to default
                    });
                    unlocked++;
                } catch { }
            }

            const embed = new EmbedBuilder()
                .setTitle('🔓 server unlocked')
                .setDescription(`\`channels\` : ${unlocked} unlocked\n\`by\` : ${interaction.user.tag}`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Unlockall error:', error);
            await interaction.editReply({ content: 'Failed to unlock server.' });
        }
    }
};
