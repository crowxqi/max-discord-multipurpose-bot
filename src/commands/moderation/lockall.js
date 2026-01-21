const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('lockall')
        .setDescription('Lock the entire server (hide all channels)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            let locked = 0;

            const channels = guild.channels.cache.filter(c =>
                c.type === ChannelType.GuildText ||
                c.type === ChannelType.GuildVoice ||
                c.type === ChannelType.GuildCategory
            );

            for (const [, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        ViewChannel: false
                    });
                    locked++;
                } catch { }
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 server locked')
                .setDescription(`\`channels\` : ${locked} locked\n\`by\` : ${interaction.user.tag}`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Lockall error:', error);
            await interaction.editReply({ content: 'Failed to lock server.' });
        }
    }
};
