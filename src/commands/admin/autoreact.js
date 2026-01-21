const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('autoreact')
        .setDescription('Manage auto reactions')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add an auto reaction')
                .addStringOption(opt =>
                    opt.setName('trigger')
                        .setDescription('The trigger word/phrase')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('emoji')
                        .setDescription('The emoji to react with')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove an auto reaction')
                .addStringOption(opt =>
                    opt.setName('trigger')
                        .setDescription('The trigger to remove')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all auto reactions'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const trigger = interaction.options.getString('trigger', true).toLowerCase();
            const emoji = interaction.options.getString('emoji', true);

            statements.addAutoreact.run(interaction.guildId, trigger, emoji);

            const embed = new EmbedBuilder()
                .setTitle('autoreact added ✅')
                .setDescription(`\`trigger\` : ${trigger}\n\`emoji\` : ${emoji}`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        else if (sub === 'remove') {
            const trigger = interaction.options.getString('trigger', true).toLowerCase();

            statements.removeAutoreact.run(interaction.guildId, trigger);

            const embed = new EmbedBuilder()
                .setTitle('autoreact removed ❌')
                .setDescription(`\`trigger\` : ${trigger}`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        else if (sub === 'list') {
            const reacts = statements.getAutoreacts.all(interaction.guildId);

            const list = reacts.length > 0
                ? reacts.map((r, i) => `${i + 1}. \`${r.trigger_word}\` → ${r.emoji}`).join('\n')
                : 'No autoreacts set.';

            const embed = new EmbedBuilder()
                .setTitle('📋 autoreacts')
                .setDescription(list)
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
