const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('warnlist')
        .setDescription('View a user\'s warning history')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user', true);

        try {
            const warnings = statements.getWarnings.all(interaction.guildId, target.id);

            if (warnings.length === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle(`${target.tag} warnings`)
                        .setDescription('No warnings found for this user.')
                        .setColor(0x00FF00)
                        .setTimestamp()
                    ]
                });
            }

            // Create warning list
            const warningList = warnings.map((w, index) => {
                const date = Math.floor(new Date(w.created_at).getTime() / 1000);
                return `**${index + 1}.** Reason: ${w.reason}\nMod: <@${w.moderator_id}> | Date: <t:${date}:R>`;
            }).join('\n\n');

            // Split into chunks if too long (simple handling, just taking first 10 for now or simple slice)
            // For better UX, we'll show up to 10 latest warnings
            const displayWarnings = warnings.slice(0, 10).map((w, index) => {
                const date = Math.floor(new Date(w.created_at).getTime() / 1000);
                return `\`${index + 1}\` **Reason:** ${w.reason}\n**Mod:** <@${w.moderator_id}> • <t:${date}:R>`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle(`${target.tag} warnings`)
                .setDescription(displayWarnings)
                .setFooter({ text: `Total Warnings: ${warnings.length} | Showing latest 10` })
                .setColor(0xFFAA00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Warnlist error:', error);
            await interaction.reply({
                embeds: [embeds.error('Error', 'Failed to fetch warnings.')],
                ephemeral: true
            });
        }
    }
};
