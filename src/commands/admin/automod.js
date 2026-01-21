const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure automod settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Get current settings
        let settings = statements.getAutomod.get(interaction.guildId);
        if (!settings) {
            statements.setAutomod.run(interaction.guildId, 0, 0, 0, 0, 0);
            settings = { block_links: 0, block_invites: 0, block_spam: 0, block_mass_emoji: 0, block_mass_mentions: 0 };
        }

        const getStatus = (val) => val ? '✅ ON' : '❌ OFF';

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Automod Settings')
            .setDescription(
                `**Current Status:**\n\n` +
                `🔗 Block Links: ${getStatus(settings.block_links)}\n` +
                `📨 Block Invites: ${getStatus(settings.block_invites)}\n` +
                `📢 Block Spam: ${getStatus(settings.block_spam)}\n` +
                `😀 Block Mass Emoji: ${getStatus(settings.block_mass_emoji)}\n` +
                `@️ Block Mass Mentions: ${getStatus(settings.block_mass_mentions)}`
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Select options below to toggle' })
            .setTimestamp();

        const menu = new StringSelectMenuBuilder()
            .setCustomId('automod_toggle')
            .setPlaceholder('Toggle automod features')
            .setMinValues(0)
            .setMaxValues(5)
            .addOptions([
                { label: 'Block Links', value: 'links', description: 'Block all links', default: !!settings.block_links },
                { label: 'Block Invites', value: 'invites', description: 'Block Discord invites', default: !!settings.block_invites },
                { label: 'Block Spam', value: 'spam', description: 'Block message spam', default: !!settings.block_spam },
                { label: 'Block Mass Emoji', value: 'emoji', description: 'Block excessive emojis', default: !!settings.block_mass_emoji },
                { label: 'Block Mass Mentions', value: 'mentions', description: 'Block mass pings', default: !!settings.block_mass_mentions }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        try {
            const collector = response.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'This is not for you!', ephemeral: true });
                }

                const selected = i.values;

                const newSettings = {
                    block_links: selected.includes('links') ? 1 : 0,
                    block_invites: selected.includes('invites') ? 1 : 0,
                    block_spam: selected.includes('spam') ? 1 : 0,
                    block_mass_emoji: selected.includes('emoji') ? 1 : 0,
                    block_mass_mentions: selected.includes('mentions') ? 1 : 0
                };

                statements.setAutomod.run(
                    interaction.guildId,
                    newSettings.block_links,
                    newSettings.block_invites,
                    newSettings.block_spam,
                    newSettings.block_mass_emoji,
                    newSettings.block_mass_mentions
                );

                const updatedEmbed = new EmbedBuilder()
                    .setTitle('⚙️ Automod Updated')
                    .setDescription(
                        `**Current Status:**\n\n` +
                        `🔗 Block Links: ${getStatus(newSettings.block_links)}\n` +
                        `📨 Block Invites: ${getStatus(newSettings.block_invites)}\n` +
                        `📢 Block Spam: ${getStatus(newSettings.block_spam)}\n` +
                        `😀 Block Mass Emoji: ${getStatus(newSettings.block_mass_emoji)}\n` +
                        `@️ Block Mass Mentions: ${getStatus(newSettings.block_mass_mentions)}`
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await i.update({ embeds: [updatedEmbed], components: [] });
            });
        } catch { }
    }
};
