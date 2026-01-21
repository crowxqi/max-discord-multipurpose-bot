const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Manage auto responses')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add an auto response')
                .addStringOption(opt =>
                    opt.setName('trigger')
                        .setDescription('The trigger word/phrase')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('response')
                        .setDescription('The response message')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an auto response')
                .addStringOption(opt =>
                    opt.setName('trigger')
                        .setDescription('The trigger to remove')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all auto responses'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const trigger = interaction.options.getString('trigger', true).toLowerCase();
            const response = interaction.options.getString('response', true);

            statements.addAutoresponder.run(interaction.guildId, trigger, response);

            const embed = new EmbedBuilder()
                .setTitle('autoresponder added ✅')
                .setDescription(`\`trigger\` : ${trigger}\n\`response\` : ${response}`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        else if (sub === 'remove') {
            const trigger = interaction.options.getString('trigger', true).toLowerCase();

            statements.removeAutoresponder.run(interaction.guildId, trigger);

            const embed = new EmbedBuilder()
                .setTitle('autoresponder removed ❌')
                .setDescription(`\`trigger\` : ${trigger}`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        else if (sub === 'list') {
            const responders = statements.getAutoresponders.all(interaction.guildId);

            const list = responders.length > 0
                ? responders.map((r, i) => `${i + 1}. \`${r.trigger_word}\` → ${r.response.substring(0, 50)}...`).join('\n')
                : 'No autoresponders set.';

            const embed = new EmbedBuilder()
                .setTitle('📋 autoresponders')
                .setDescription(list)
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
