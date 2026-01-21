const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage blacklisted words')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add words to blacklist')
                .addStringOption(opt =>
                    opt.setName('words')
                        .setDescription('Words to blacklist (comma separated)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a word from blacklist')
                .addStringOption(opt =>
                    opt.setName('word')
                        .setDescription('Word to remove')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all blacklisted words'))
        .addSubcommand(sub =>
            sub.setName('bypass')
                .setDescription('Add user to bypass list')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to bypass')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('unbypass')
                .setDescription('Remove user from bypass list')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to remove from bypass')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const wordsInput = interaction.options.getString('words', true);
            const words = wordsInput.split(',').map(w => w.trim().toLowerCase()).filter(w => w);

            let added = 0;
            for (const word of words) {
                try {
                    statements.addBlacklistWord.run(interaction.guildId, word);
                    added++;
                } catch { }
            }

            const embed = new EmbedBuilder()
                .setTitle('blacklist updated ✅')
                .setDescription(`\`added\` : ${added} words`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        else if (sub === 'remove') {
            const word = interaction.options.getString('word', true).toLowerCase();
            statements.removeBlacklistWord.run(interaction.guildId, word);

            const embed = new EmbedBuilder()
                .setTitle('blacklist removed ❌')
                .setDescription(`\`word\` : ${word}`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        else if (sub === 'list') {
            const words = statements.getBlacklistWords.all(interaction.guildId);
            const bypassUsers = statements.getBlacklistBypass.all(interaction.guildId);

            const wordList = words.length > 0
                ? words.map(w => `\`${w.word}\``).join(', ')
                : 'None';

            const bypassList = bypassUsers.length > 0
                ? bypassUsers.map(u => `<@${u.user_id}>`).join(', ')
                : 'None';

            const embed = new EmbedBuilder()
                .setTitle('📋 blacklist')
                .setDescription(`**Words (${words.length}):**\n${wordList}\n\n**Bypass Users:**\n${bypassList}`)
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        else if (sub === 'bypass') {
            const user = interaction.options.getUser('user', true);
            statements.addBlacklistBypass.run(interaction.guildId, user.id);

            const embed = new EmbedBuilder()
                .setTitle('bypass added ✅')
                .setDescription(`\`user\` : ${user}`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        else if (sub === 'unbypass') {
            const user = interaction.options.getUser('user', true);
            statements.removeBlacklistBypass.run(interaction.guildId, user.id);

            const embed = new EmbedBuilder()
                .setTitle('bypass removed ❌')
                .setDescription(`\`user\` : ${user}`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};
