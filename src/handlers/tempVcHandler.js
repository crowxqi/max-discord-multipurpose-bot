const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder } = require('discord.js');
const { statements } = require('../database/db');
const { EmbedBuilder } = require('discord.js');

// Error embed helper for fast responses
const errorEmbed = (msg) => new EmbedBuilder().setDescription(`❌ ${msg}`).setColor(0xFF0000);
const successEmbed = (msg) => new EmbedBuilder().setDescription(`✅ ${msg}`).setColor(0x00FF00);

async function handleTempVcButton(interaction) {
    const { customId, member, guild } = interaction;
    const voiceChannel = member.voice.channel;

    // Fast exit if not in VC
    if (!voiceChannel) return interaction.reply({ embeds: [errorEmbed('Join the VC first.')], ephemeral: true });

    // Fast cached DB check
    const tempVc = statements.getActiveTempVc.get(voiceChannel.id);
    if (!tempVc) return interaction.reply({ embeds: [errorEmbed('Not a Temp VC.')], ephemeral: true });

    // Fast ownership check
    const isOwner = tempVc.owner_id === member.id;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    if (customId !== 'tvc_claim' && !isOwner && !isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('You do not own this voice channel!')], ephemeral: true });
    }

    // === HANDLERS ===
    if (customId === 'tvc_name') {
        const modal = new ModalBuilder().setCustomId('tvc_modal_name').setTitle('Change Name');
        const nameInput = new TextInputBuilder().setCustomId('name').setLabel('New Name').setStyle(TextInputStyle.Short).setMaxLength(100);
        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        return interaction.showModal(modal);
    }

    else if (customId === 'tvc_limit') {
        const modal = new ModalBuilder().setCustomId('tvc_modal_limit').setTitle('Set User Limit');
        const limitInput = new TextInputBuilder().setCustomId('limit').setLabel('Limit (0-99)').setStyle(TextInputStyle.Short).setMaxLength(2);
        modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
        return interaction.showModal(modal);
    }

    else if (customId === 'tvc_privacy') {
        const select = new StringSelectMenuBuilder()
            .setCustomId('tvc_select_privacy')
            .setPlaceholder('Select Privacy Option')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Lock').setDescription('Only trusted can join').setValue('lock').setEmoji('🔒'),
                new StringSelectMenuOptionBuilder().setLabel('Unlock').setDescription('Everyone can join').setValue('unlock').setEmoji('🔓'),
                new StringSelectMenuOptionBuilder().setLabel('Invisible').setDescription('Only trusted can view').setValue('invisible').setEmoji('👻'),
                new StringSelectMenuOptionBuilder().setLabel('Visible').setDescription('Everyone can view').setValue('visible').setEmoji('👁️')
            );
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_kick') {
        const select = new UserSelectMenuBuilder().setCustomId('tvc_select_kick').setPlaceholder('Select user to kick').setMaxValues(1);
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_trust') {
        const select = new UserSelectMenuBuilder().setCustomId('tvc_select_trust').setPlaceholder('Select user to trust').setMaxValues(10);
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_untrust') {
        const select = new UserSelectMenuBuilder().setCustomId('tvc_select_untrust').setPlaceholder('Select user to untrust').setMaxValues(10);
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_block') {
        const select = new UserSelectMenuBuilder().setCustomId('tvc_select_block').setPlaceholder('Select user to block').setMaxValues(10);
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_unblock') {
        const select = new UserSelectMenuBuilder().setCustomId('tvc_select_unblock').setPlaceholder('Select user to unblock').setMaxValues(10);
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_transfer') {
        const select = new UserSelectMenuBuilder().setCustomId('tvc_select_transfer').setPlaceholder('Select new owner').setMaxValues(1);
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_region') {
        const select = new StringSelectMenuBuilder()
            .setCustomId('tvc_select_region')
            .setPlaceholder('Select Region')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Automatic').setValue('automatic').setEmoji('🤖'),
                new StringSelectMenuOptionBuilder().setLabel('Brazil').setValue('brazil').setEmoji('🇧🇷'),
                new StringSelectMenuOptionBuilder().setLabel('Rotterdam').setValue('rotterdam').setEmoji('🇳🇱'),
                new StringSelectMenuOptionBuilder().setLabel('Hong Kong').setValue('hongkong').setEmoji('🇭🇰'),
                new StringSelectMenuOptionBuilder().setLabel('India').setValue('india').setEmoji('🇮🇳'),
                new StringSelectMenuOptionBuilder().setLabel('Japan').setValue('japan').setEmoji('🇯🇵'),
                new StringSelectMenuOptionBuilder().setLabel('Russia').setValue('russia').setEmoji('🇷🇺'),
                new StringSelectMenuOptionBuilder().setLabel('Singapore').setValue('singapore').setEmoji('🇸🇬'),
                new StringSelectMenuOptionBuilder().setLabel('Sydney').setValue('sydney').setEmoji('🇦🇺'),
                new StringSelectMenuOptionBuilder().setLabel('US Central').setValue('us-central').setEmoji('🇺🇸'),
                new StringSelectMenuOptionBuilder().setLabel('US East').setValue('us-east').setEmoji('🇺🇸'),
                new StringSelectMenuOptionBuilder().setLabel('US South').setValue('us-south').setEmoji('🇺🇸'),
                new StringSelectMenuOptionBuilder().setLabel('US West').setValue('us-west').setEmoji('🇺🇸')
            );
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    else if (customId === 'tvc_delete') {
        await interaction.reply({ embeds: [new EmbedBuilder().setDescription('🗑️ Deleting channel...').setColor(0xFF0000)], ephemeral: true });
        voiceChannel.delete().catch(() => { });
        statements.removeActiveTempVc.run(voiceChannel.id);
    }

    else if (customId === 'tvc_claim') {
        const currentOwner = guild.members.cache.get(tempVc.owner_id);
        if (currentOwner && currentOwner.voice.channelId === voiceChannel.id) {
            return interaction.reply({ embeds: [errorEmbed('Owner is still present!')], ephemeral: true });
        }
        statements.updateTempVcOwner.run(member.id, voiceChannel.id);
        voiceChannel.permissionOverwrites.edit(member.id, { ManageChannels: true, MoveMembers: true, Connect: true }).catch(() => { });
        return interaction.reply({ embeds: [new EmbedBuilder().setDescription('👑 You claimed this channel!').setColor(0xFFD700)], ephemeral: true });
    }
}

async function handleTempVcSelect(interaction) {
    const { customId, values, member, guild } = interaction;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) return interaction.reply({ content: '❌ Join the VC first.', ephemeral: true });

    // === PRIVACY ===
    if (customId === 'tvc_select_privacy') {
        const value = values[0];
        try {
            if (value === 'lock') {
                voiceChannel.permissionOverwrites.edit(guild.id, { Connect: false }).catch(() => { });
                statements.updateTempVcLock.run(1, voiceChannel.id);
                return interaction.reply({ embeds: [new EmbedBuilder().setDescription('🔒 Channel locked.').setColor(0x00FF00)], ephemeral: true });
            } else if (value === 'unlock') {
                voiceChannel.permissionOverwrites.edit(guild.id, { Connect: true }).catch(() => { });
                statements.updateTempVcLock.run(0, voiceChannel.id);
                return interaction.reply({ embeds: [new EmbedBuilder().setDescription('🔓 Channel unlocked.').setColor(0x00FF00)], ephemeral: true });
            } else if (value === 'invisible') {
                voiceChannel.permissionOverwrites.edit(guild.id, { ViewChannel: false }).catch(() => { });
                return interaction.reply({ embeds: [new EmbedBuilder().setDescription('👻 Channel invisible.').setColor(0x00FF00)], ephemeral: true });
            } else if (value === 'visible') {
                voiceChannel.permissionOverwrites.edit(guild.id, { ViewChannel: true }).catch(() => { });
                return interaction.reply({ embeds: [new EmbedBuilder().setDescription('👁️ Channel visible.').setColor(0x00FF00)], ephemeral: true });
            }
        } catch (e) { return interaction.reply({ embeds: [errorEmbed('Error updating privacy.')], ephemeral: true }); }
    }

    // === KICK ===
    else if (customId === 'tvc_select_kick') {
        const targetId = values[0];
        const target = guild.members.cache.get(targetId);
        if (target && target.voice.channelId === voiceChannel.id) {
            target.voice.disconnect('Kicked by owner').catch(() => { });
            return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`👢 Kicked **${target.user.tag}**`).setColor(0x00FF00)], ephemeral: true });
        }
        return interaction.reply({ embeds: [errorEmbed('User not in channel.')], ephemeral: true });
    }

    // === TRUST (parallel) ===
    else if (customId === 'tvc_select_trust') {
        Promise.all(values.map(uid => voiceChannel.permissionOverwrites.edit(uid, { Connect: true, ViewChannel: true, Speak: true }).catch(() => { })));
        return interaction.reply({ embeds: [successEmbed(`Trusted **${values.length}** users.`)], ephemeral: true });
    }

    // === UNTRUST (parallel) ===
    else if (customId === 'tvc_select_untrust') {
        Promise.all(values.map(uid => voiceChannel.permissionOverwrites.delete(uid).catch(() => { })));
        return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🚫 Untrusted **${values.length}** users.`).setColor(0xFFA500)], ephemeral: true });
    }

    // === BLOCK (parallel) ===
    else if (customId === 'tvc_select_block') {
        Promise.all(values.map(async uid => {
            voiceChannel.permissionOverwrites.edit(uid, { Connect: false, ViewChannel: false }).catch(() => { });
            const target = guild.members.cache.get(uid);
            if (target && target.voice.channelId === voiceChannel.id) {
                target.voice.disconnect('Blocked from channel').catch(() => { });
            }
        }));
        return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🚫 Blocked **${values.length}** users.`).setColor(0xFF0000)], ephemeral: true });
    }

    // === UNBLOCK (parallel) ===
    else if (customId === 'tvc_select_unblock') {
        Promise.all(values.map(uid => voiceChannel.permissionOverwrites.delete(uid).catch(() => { })));
        return interaction.reply({ embeds: [successEmbed(`Unblocked **${values.length}** users.`)], ephemeral: true });
    }

    // === TRANSFER (parallel) ===
    else if (customId === 'tvc_select_transfer') {
        const newOwnerId = values[0];

        // Run permission edits in parallel
        voiceChannel.permissionOverwrites.edit(member.id, { ManageChannels: null, MoveMembers: null }).catch(() => { });
        voiceChannel.permissionOverwrites.edit(newOwnerId, { ManageChannels: true, MoveMembers: true, Connect: true }).catch(() => { });

        statements.updateTempVcOwner.run(newOwnerId, voiceChannel.id);

        return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`👑 Ownership transferred to <@${newOwnerId}>`).setColor(0xFFD700)], ephemeral: true });
    }

    // === REGION ===
    else if (customId === 'tvc_select_region') {
        const region = values[0];
        try {
            await voiceChannel.setRTCRegion(region === 'automatic' ? null : region);
            return interaction.reply({ embeds: [successEmbed(`Region set to **${region}**`)], ephemeral: true });
        } catch (e) {
            console.error(e);
            return interaction.reply({ embeds: [errorEmbed('Failed to set region.')], ephemeral: true });
        }
    }
}

async function handleTempVcModal(interaction) {
    const { customId, fields, member } = interaction;
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return interaction.reply({ embeds: [errorEmbed('Join the VC first.')], ephemeral: true });

    if (customId === 'tvc_modal_name') {
        const name = fields.getTextInputValue('name');
        await voiceChannel.setName(name);
        return interaction.reply({ embeds: [successEmbed(`Renamed to **${name}**`)], ephemeral: true });
    } else if (customId === 'tvc_modal_limit') {
        const limit = parseInt(fields.getTextInputValue('limit'));
        if (isNaN(limit) || limit < 0 || limit > 99) return interaction.reply({ embeds: [errorEmbed('Invalid limit (0-99).')], ephemeral: true });
        await voiceChannel.setUserLimit(limit);
        return interaction.reply({ embeds: [successEmbed(`User limit set to **${limit}**`)], ephemeral: true });
    }
}

module.exports = { handleTempVcButton, handleTempVcModal, handleTempVcSelect };
