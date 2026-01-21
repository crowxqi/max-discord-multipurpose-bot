const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                embeds: [embeds.error('User Not Found', 'Could not find this user in the server.')],
                ephemeral: true
            });
        }

        if (target.bot) {
            return interaction.reply({
                embeds: [embeds.error('Cannot Warn', 'You cannot warn a bot.')],
                ephemeral: true
            });
        }

        try {
            // Add warning to database
            statements.addWarning.run(
                interaction.guildId,
                target.id,
                interaction.user.id,
                reason
            );

            // Log to modlog
            statements.addModlog.run(
                interaction.guildId,
                target.id,
                interaction.user.id,
                'WARN',
                reason,
                null
            );

            // Get warning count
            const warnings = statements.getWarnings.all(interaction.guildId, target.id);

            // Create custom warn embed
            const warnEmbed = new EmbedBuilder()
                .setTitle(`warn ${target.tag}`)
                .setDescription(`\`warn count\` : ${warnings.length}\n\`warn reason\` : ${reason}\n\`warn by\` : ${interaction.user.tag}`)
                .setColor(0x4D0000)
                .setFooter({
                    text: `${target.tag} has got warned`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [warnEmbed]
            });

            // Try to DM the user
            try {
                await target.send({
                    embeds: [embeds.warning(
                        `Warning in ${interaction.guild.name}`,
                        `You have been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${warnings.length}`
                    )]
                });
            } catch {
                // User has DMs disabled
            }
        } catch (error) {
            console.error('Warn error:', error);
            await interaction.reply({
                embeds: [embeds.error('Warn Failed', 'Failed to warn the user.')],
                ephemeral: true
            });
        }
    }
};
