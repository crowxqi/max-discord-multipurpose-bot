const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('ticketsetup')
        .setDescription('Initialize the Ticket System (Category, Transcripts, Role)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;

            // 1. Create Category
            const category = await guild.channels.create({
                name: '🎫 Tickets',
                type: ChannelType.GuildCategory
            });

            // 2. Create Support Role (if not exists, we'll make one)
            let supportRole = guild.roles.cache.find(r => r.name === 'Support Team');
            if (!supportRole) {
                supportRole = await guild.roles.create({
                    name: 'Support Team',
                    color: '#3498db',
                    reason: 'Ticket System Setup'
                });
            }

            // 3. Create Transcripts Channel
            const transcriptChannel = await guild.channels.create({
                name: '📄-transcripts',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: supportRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            // 4. Save to Database
            // Default panel JSON (can be customized later via /ticketpanel)
            const defaultPanel = JSON.stringify({
                title: 'Support Tickets',
                description: 'Click the button below to open a ticket.',
                color: 0x5865F2
            });

            statements.setTicketSettings.run(guild.id, category.id, transcriptChannel.id, supportRole.id, defaultPanel);

            const embed = new EmbedBuilder()
                .setTitle('Ticket System Setup Complete ✅')
                .setDescription(
                    `**Category:** ${category.name}\n` +
                    `**Transcripts:** ${transcriptChannel}\n` +
                    `**Support Role:** ${supportRole}\n\n` +
                    `**Next Step:** Use \`/ticketpanel\` to send the ticket creation panel to a channel.`
                )
                .setColor(0x00FF00);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Ticket setup error:', error);
            await interaction.editReply({ content: '❌ Failed to setup Ticket System. Check my permissions.' });
        }
    }
};
