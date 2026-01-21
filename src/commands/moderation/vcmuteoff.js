const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('vcmuteoff')
        .setDescription('Disable VC mute and unmute everyone')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: 'You must be in a voice channel!',
                ephemeral: true
            });
        }

        try {
            // Remove from vcmute channels
            statements.removeVcmuteChannel.run(voiceChannel.id);

            // Unmute everyone in the channel
            for (const [, member] of voiceChannel.members) {
                if (!member.user.bot) {
                    try {
                        await member.voice.setMute(false);
                    } catch { }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('vcmuteall disabled 🔊')
                .setDescription(`\`channel\` : ${voiceChannel.name}\n\`unmuted\` : ${voiceChannel.members.size} users`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('VCMuteOff error:', error);
            await interaction.reply({ content: 'Failed to disable VC mute.', ephemeral: true });
        }
    }
};
