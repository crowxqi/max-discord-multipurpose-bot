const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Manage sticky messages')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set a sticky message')
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription('The message to stick')
                        .setRequired(true))
                .addBooleanOption(opt =>
                    opt.setName('embed')
                        .setDescription('Send as embed? (default: true)')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove sticky message from this channel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const content = interaction.options.getString('message', true);
            const isEmbed = interaction.options.getBoolean('embed') ?? true; // Default to true

            try {
                // Send the sticky message
                let stickyMsg;
                if (isEmbed) {
                    stickyMsg = await interaction.channel.send({
                        embeds: [new EmbedBuilder()
                            .setDescription(`📌 ${content}`)
                            .setColor(0xFFD700)
                            .setFooter({ text: 'Sticky Message' })]
                    });
                } else {
                    stickyMsg = await interaction.channel.send({ content: `**📌 Sticky Message:**\n${content}` });
                }

                // Save to database
                statements.setSticky.run(interaction.guildId, interaction.channelId, stickyMsg.id, content, isEmbed ? 1 : 0);

                const embed = new EmbedBuilder()
                    .setTitle('sticky set 📌')
                    .setDescription(`\`channel\` : <#${interaction.channelId}>\n\`type\` : ${isEmbed ? 'Embed' : 'Message'}`)
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('Sticky set error:', error);
                await interaction.reply({ content: 'Failed to set sticky message.', ephemeral: true });
            }
        }

        else if (sub === 'remove') {
            try {
                const sticky = statements.getSticky.get(interaction.channelId);

                if (!sticky) {
                    return interaction.reply({ content: 'No sticky message in this channel.', ephemeral: true });
                }

                // Try to delete the sticky message
                try {
                    const msg = await interaction.channel.messages.fetch(sticky.message_id);
                    await msg.delete();
                } catch { }

                statements.removeSticky.run(interaction.channelId);

                const embed = new EmbedBuilder()
                    .setTitle('sticky removed 📌')
                    .setDescription(`\`channel\` : <#${interaction.channelId}>`)
                    .setColor(0xFF0000)
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('Sticky remove error:', error);
                await interaction.reply({ content: 'Failed to remove sticky.', ephemeral: true });
            }
        }
    }
};
