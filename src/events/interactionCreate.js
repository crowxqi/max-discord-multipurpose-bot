const { hasPermission } = require('../handlers/permissionHandler');
const embeds = require('../utils/embeds');
const { handleTempVcButton, handleTempVcModal } = require('../handlers/tempVcHandler');
const { handleTicketButton, handleTicketModal, handleTicketSelect } = require('../handlers/ticketHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // DEBUG LOG
        console.log(`Received interaction: ${interaction.type} (ID: ${interaction.customId || interaction.commandName})`);

        // Handle Temp VC Buttons
        if (interaction.isButton() && interaction.customId.startsWith('tvc_')) {
            return handleTempVcButton(interaction);
        }

        // Handle Temp VC Modals
        if (interaction.isModalSubmit() && interaction.customId.startsWith('tvc_modal_')) {
            return handleTempVcModal(interaction);
        }

        // Handle Temp VC Select Menus (String or User)
        if ((interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) && interaction.customId.startsWith('tvc_select_')) {
            return require('../handlers/tempVcHandler').handleTempVcSelect(interaction);
        }

        // Handle Ticket Buttons
        if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
            return handleTicketButton(interaction);
        }

        // Handle Ticket Modals
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
            return handleTicketModal(interaction);
        }

        // Handle Ticket Select Menus
        if ((interaction.isChannelSelectMenu() || interaction.isStringSelectMenu()) && (interaction.customId.startsWith('ticket_builder_') || interaction.customId === 'ticket_category_select')) {
            return handleTicketSelect(interaction);
        }

        // Fast exit for non-commands after checking buttons/modals
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Fast permission check
        if (command.permission && !hasPermission(interaction.member, command.permission, interaction.guildId)) {
            return interaction.reply({ embeds: [embeds.error('❌', 'No permission.')], ephemeral: true });
        }

        try {
            await command.execute(interaction, client);
        } catch (e) {
            console.error(`Cmd error ${interaction.commandName}:`, e);
            const err = embeds.error('Error', 'Command failed.');
            if (interaction.replied || interaction.deferred) interaction.followUp({ embeds: [err], ephemeral: true }).catch(() => { });
            else interaction.reply({ embeds: [err], ephemeral: true }).catch(() => { });
        }
    }
};
