const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const embeds = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
    permission: config.permissions.STAFF,
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount', true);
        const targetUser = interaction.options.getUser('user');

        await interaction.deferReply({ ephemeral: true });

        try {
            let messages = await interaction.channel.messages.fetch({ limit: 100 });

            // Filter by user if specified
            if (targetUser) {
                messages = messages.filter(m => m.author.id === targetUser.id);
            }

            // Filter out messages older than 14 days (Discord limitation)
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

            // Limit to requested amount
            messages = [...messages.values()].slice(0, amount);

            if (messages.length === 0) {
                return interaction.editReply({
                    embeds: [embeds.error('No Messages', 'No messages found to delete that are less than 14 days old.')]
                });
            }

            // Bulk delete
            const deleted = await interaction.channel.bulkDelete(messages, true);

            // Log to database
            statements.addModlog.run(
                interaction.guildId,
                targetUser?.id || 'channel',
                interaction.user.id,
                'PURGE',
                `Deleted ${deleted.size} messages${targetUser ? ` from ${targetUser.tag}` : ''}`,
                null
            );

            // Create custom purge embed
            const purgeEmbed = new EmbedBuilder()
                .setTitle(`purge count ${deleted.size}`)
                .setColor(0xF8E8F8)
                .setTimestamp();

            await interaction.editReply({
                embeds: [purgeEmbed]
            });
        } catch (error) {
            console.error('Purge error:', error);
            await interaction.editReply({
                embeds: [embeds.error('Purge Failed', 'Failed to delete messages. Make sure messages are less than 14 days old.')]
            });
        }
    }
};
