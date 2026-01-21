const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Open the Interactive Ticket Panel Builder')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Ephemeral builder interface
        await interaction.deferReply({ ephemeral: true });

        // Default Draft State
        const embed = new EmbedBuilder()
            .setTitle('Support Tickets')
            .setDescription('Need help? Click the button below to open a ticket!')
            .setColor(0x5865F2); // Blurple

        const btn = new ButtonBuilder()
            .setCustomId('ticket_create_preview') // Non-functional preview
            .setLabel('Open Ticket')
            .setEmoji('📩')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);

        const previewRow = new ActionRowBuilder().addComponents(btn);

        // Control Buttons Row 1 - Embed Options
        const controlRow1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_builder_edit_embed').setLabel('Edit Embed').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('ticket_builder_set_image').setLabel('Image').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
            new ButtonBuilder().setCustomId('ticket_builder_set_thumbnail').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary).setEmoji('🎨')
        );

        // Control Buttons Row 2 - Button Options
        const controlRow2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_builder_edit_button').setLabel('Edit Button').setStyle(ButtonStyle.Secondary).setEmoji('🔘'),
            new ButtonBuilder().setCustomId('ticket_builder_add_button').setLabel('Add Button').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('ticket_builder_remove_button').setLabel('Remove').setStyle(ButtonStyle.Danger).setEmoji('➖'),
            new ButtonBuilder().setCustomId('ticket_builder_add_category').setLabel('Categories').setStyle(ButtonStyle.Secondary).setEmoji('📂'),
            new ButtonBuilder().setCustomId('ticket_builder_send').setLabel('Send').setStyle(ButtonStyle.Success).setEmoji('🚀')
        );

        await interaction.editReply({
            content: '🎨 **Ticket Panel Builder**\nCustomize your panel below. Add multiple buttons and categories!\n\n📝 **Row 1:** Embed options (text, image, color)\n🔘 **Row 2:** Button controls + Send',
            embeds: [embed],
            components: [previewRow, controlRow1, controlRow2]
        });
    }
};
