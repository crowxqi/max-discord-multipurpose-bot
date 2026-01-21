const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('vcban')
        .setDescription('Ban a user from voice channels')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to VC ban')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for VC ban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            const guildData = statements.getGuild.get(interaction.guildId);

            if (!guildData?.vcban_role) {
                return interaction.reply({
                    content: 'VC ban not setup! Use `/vcbansetup` first.',
                    ephemeral: true
                });
            }

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) {
                return interaction.reply({ content: 'User not found.', ephemeral: true });
            }

            // Add the vcban role
            await member.roles.add(guildData.vcban_role);

            // Disconnect from VC if connected
            if (member.voice.channel) {
                await member.voice.disconnect();
            }

            // Save to database
            statements.addVcban.run(interaction.guildId, target.id, interaction.user.id, reason);

            const embed = new EmbedBuilder()
                .setTitle(`${target.tag} vc banned 🔇`)
                .setDescription(`\`reason\` : ${reason}\n\`by\` : ${interaction.user.tag}`)
                .setColor(0xFF0000)
                .setFooter({ text: `vc banned ${target.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('VCBan error:', error);
            await interaction.reply({ content: 'Failed to VC ban user.', ephemeral: true });
        }
    }
};
