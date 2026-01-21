const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('vcmuteall')
        .setDescription('Mute everyone who joins your current VC')
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
            // Add to vcmute channels
            statements.addVcmuteChannel.run(interaction.guildId, voiceChannel.id);

            // Mute everyone currently in the channel
            for (const [, member] of voiceChannel.members) {
                if (!member.user.bot && member.id !== interaction.user.id) {
                    try {
                        await member.voice.setMute(true);
                    } catch { }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('vcmuteall enabled 🔇')
                .setDescription(`\`channel\` : ${voiceChannel.name}\n\`muted\` : ${voiceChannel.members.size - 1} users`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('VCMuteAll error:', error);
            await interaction.reply({ content: 'Failed to enable VC mute.', ephemeral: true });
        }
    }
};
