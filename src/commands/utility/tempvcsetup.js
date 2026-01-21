const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { statements } = require('../../database/db');
const config = require('../../config');

module.exports = {
    permission: config.permissions.ADMIN,
    data: new SlashCommandBuilder()
        .setName('tempvcsetup')
        .setDescription('Setup the Temp Voice system (Category, Channels, Interface)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;

            // 1. Create Category
            const category = await guild.channels.create({
                name: '🔊 Temporary Voice',
                type: ChannelType.GuildCategory
            });

            // 2. Create Join Channel
            const joinChannel = await guild.channels.create({
                name: '➕ Join to Create',
                type: ChannelType.GuildVoice,
                parent: category.id,
                userLimit: 1
            });

            // 3. Create Interface Channel
            const interfaceChannel = await guild.channels.create({
                name: '⚙️-vc-control',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.SendMessages],
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            // 4. Create Interface Embed & Buttons
            const embed = new EmbedBuilder()
                .setTitle('TempVoice Interface')
                .setDescription(
                    'Click the buttons below to control your voice channel.\n\n' +
                    '> **📝 Name**\n>  `Change the name of your channel`\n' +
                    '> **👥 Limit**\n>  `Set the maximum user limit`\n' +
                    '> **🔒 Privacy**\n>  `Lock/Unlock/Hide your channel`\n' +
                    '> **👢 Kick**\n>  `Kick a user from your channel`\n' +
                    '> **✅ Trust**\n> `Permit a user to join`\n' +
                    '> **❌ Untrust**\n> `Remove trust from a user`\n' +
                    '> **🚫 Block**\n> `Ban a user from your channel`\n' +
                    '> **⭕ Unblock**\n> `Unban a user`\n' +
                    '> **👑 Claim**\n> `Claim ownership of the channel`\n' +
                    '> **🔁 Transfer**\n> `Transfer ownership to another user`\n' +
                    '> **🌐 Region**\n> `Change the voice region`\n' +
                    '> **🗑️ Delete**\n> `Delete your channel`'
                )
                .setImage('https://media.discordapp.net/attachments/123456789/tempvc_control.png') // Placeholder
                .setColor(16620186); // Decimal for #FD8A9A (Pinkish)

            // Row 1
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tvc_name').setEmoji('📝').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tvc_limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tvc_privacy').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tvc_kick').setEmoji('👢').setStyle(ButtonStyle.Secondary)
            );

            // Row 2
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tvc_trust').setEmoji('✅').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tvc_untrust').setEmoji('❌').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tvc_block').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tvc_unblock').setEmoji('⭕').setStyle(ButtonStyle.Secondary)
            );

            // Row 3
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tvc_claim').setEmoji('👑').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('tvc_transfer').setEmoji('🔁').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('tvc_region').setEmoji('🌐').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tvc_delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
            );

            await interfaceChannel.send({ embeds: [embed], components: [row1, row2, row3] });

            // 5. Save to Database
            statements.setTempVcSettings.run(guild.id, category.id, joinChannel.id, interfaceChannel.id);

            const successEmbed = new EmbedBuilder()
                .setTitle('Temp Voice Setup Complete ✅')
                .setDescription(`Created category, join channel, and control panel in ${interfaceChannel}`)
                .setColor(0x00FF00);

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('TempVC setup error:', error);
            await interaction.editReply({ content: 'Failed to setup Temp VC system. Make sure I have Administrator permissions.' });
        }
    }
};
