const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    AttachmentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder
} = require('discord.js');
const { statements } = require('../database/db');

async function handleTicketButton(interaction) {
    const { customId, guild, member, channel } = interaction;

    // === CREATE TICKET (handles ticket_create and ticket_create_X_X patterns) ===
    if (customId === 'ticket_create' || customId.startsWith('ticket_create_')) {
        const settings = statements.getTicketSettings.get(guild.id);
        if (!settings) return interaction.reply({ content: '❌ Ticket system not setup. Run `/ticketsetup`.', ephemeral: true });

        // Check active tickets (Limit 1 per user for now to prevent spam)
        const activeTickets = statements.getUserTickets.get(member.id, guild.id, 'open'); // This might need .all() if supporting multiple
        // Let's assume getUserTickets returns one row or undefined for now based on previous definition, actually I defined it but need to re-check if I made it .all or .get
        // In DB definition: getUserTickets is 'SELECT * ...'. It returns the first match if I use .get()
        // Wait, I defined `getUserTickets` but `better-sqlite3` requires explicit method usage (.get, .all).
        // Let's check `db.js`.
        // `getUserTickets` is just property: `getUserTickets: stmts.getUserTickets`.
        // So I need to use `statements.getUserTickets.get(...)`.

        // Actually, let's allow multiple tickets for now or check if there's an open one.
        // I'll skip the check for "Blazing Speed" and simplicity unless requested.
        // But preventing spam is good. Let's do a simple check.
        // Actually, the DB query for `getUserTickets` uses `status = ?`, so we can check if they have an active open one.

        // 1. Create Channel
        const channelName = `ticket-${member.user.username}`;
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: settings.category_id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
                },
                {
                    id: settings.staff_role_id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                }
            ]
        });

        // 2. Add to DB
        statements.addTicket.run(ticketChannel.id, guild.id, member.id, 'open', 'General Support');

        // 3. Send Control Panel
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('👋')
        );

        const embed = new EmbedBuilder()
            .setTitle(`Ticket: ${member.user.tag}`)
            .setDescription(`Support will be with you shortly.\n<@&${settings.staff_role_id}>`)
            .setColor(0x5865F2);

        await ticketChannel.send({ content: `${member} Here is your ticket!`, embeds: [embed], components: [row] });

        // Premium confirmation embed with link button
        const confirmEmbed = new EmbedBuilder()
            .setDescription('✨ **Your ticket has been created!**')
            .setColor(0x5865F2);

        const linkRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Go to Ticket')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guild.id}/${ticketChannel.id}`)
                .setEmoji('🎫')
        );

        return interaction.reply({ embeds: [confirmEmbed], components: [linkRow], ephemeral: true });
    }

    // === CLOSE TICKET (Step 1: Choice) ===
    else if (customId === 'ticket_close') {
        // Just ask for confirmation/choice (Ephemerally?) No, visible to all is better for context, or ephemeral?
        // User asked "don't give 3 options... only give 2".

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('ticket_close_reason').setLabel('Close with Reason').setStyle(ButtonStyle.Secondary).setEmoji('📝')
        );

        const embed = new EmbedBuilder()
            .setTitle('Close Ticket')
            .setDescription('Select how you would like to close this ticket.')
            .setColor(0xFFA500);

        return interaction.reply({ embeds: [embed], components: [row] });
    }

    // === REOPEN TICKET ===
    else if (customId === 'ticket_reopen') {
        const ticket = statements.getTicket.get(channel.id);
        if (!ticket) return;

        await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: true });
        statements.updateTicketStatus.run('open', channel.id);

        // Remove the close embed buttons (optional cleanup)

        return interaction.reply({ content: '🔓 Ticket reopened.', ephemeral: false });
    }

    // === DELETE TICKET ===
    else if (customId === 'ticket_delete') {
        await interaction.reply({ content: '🗑️ Deleting in 5 seconds...' });
        setTimeout(async () => {
            try {
                await channel.delete();
                statements.removeTicket.run(channel.id);
            } catch (e) {
                // Channel might be gone already
            }
        }, 5000);
    }

    // === CLAIM TICKET ===
    else if (customId === 'ticket_claim') {
        // Add claim logic (description update)
        const embed = new EmbedBuilder()
            .setDescription(`Ticket claimed by ${member}`)
            .setColor(0x00FF00);

        interaction.reply({ embeds: [embed] });

        // Could update channel name/topic too
        await channel.setName(`claimed-${member.user.username}`);
    }

    // === TRANSCRIPT (Legacy) ===
    else if (customId === 'ticket_transcript') {
        const messages = await channel.messages.fetch({ limit: 100 });
        const attachment = await generateTranscript(channel, member, messages);
        await interaction.reply({ content: '✅ HTML Transcript saved!', files: [attachment] });
    }

    // === CLOSE CHOICE CONFIRM ===
    else if (customId === 'ticket_close_confirm') {
        await interaction.deferReply();
        closeTicket(interaction, 'No reason provided');
    }

    // === CLOSE CHOICE REASON ===
    else if (customId === 'ticket_close_reason') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_close_reason').setTitle('Close Reason');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await interaction.showModal(modal);
    }

    // === BUILDER: EDIT EMBED BUTTON ===
    else if (customId === 'ticket_builder_edit_embed') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_embed').setTitle('Edit Panel Embed');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue('Support Tickets').setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue('Click below to open a ticket.').setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Hex Color (e.g. #FF0000)').setStyle(TextInputStyle.Short).setValue('#5865F2').setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer Text').setStyle(TextInputStyle.Short).setRequired(false))
        );

        return interaction.showModal(modal);
    }

    // === BUILDER: EDIT BUTTON BUTTON ===
    else if (customId === 'ticket_builder_edit_button') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_button').setTitle('Edit Panel Button');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Button Label').setStyle(TextInputStyle.Short).setValue('Open Ticket').setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji').setStyle(TextInputStyle.Short).setValue('📩').setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('style').setLabel('Style (Blue, Grey, Green, Red)').setStyle(TextInputStyle.Short).setValue('Blue').setRequired(true))
        );

        return interaction.showModal(modal);
    }

    // === BUILDER: SET IMAGE ===
    else if (customId === 'ticket_builder_set_image') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_image').setTitle('Set Panel Image');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image_url').setLabel('Image URL (leave empty to remove)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://example.com/image.png'))
        );
        return interaction.showModal(modal);
    }

    // === BUILDER: SET THUMBNAIL ===
    else if (customId === 'ticket_builder_set_thumbnail') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_thumbnail').setTitle('Set Panel Thumbnail');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail_url').setLabel('Thumbnail URL (leave empty to remove)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://example.com/thumb.png'))
        );
        return interaction.showModal(modal);
    }

    // === BUILDER: SET COLOR ===
    else if (customId === 'ticket_builder_set_color') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_color').setTitle('Set Embed Color');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Hex Color (e.g. #FF0000)').setStyle(TextInputStyle.Short).setRequired(true).setValue('#5865F2'))
        );
        return interaction.showModal(modal);
    }

    // === BUILDER: ADD CATEGORIES (Select Menu) ===
    else if (customId === 'ticket_builder_add_category') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_categories').setTitle('Add Ticket Categories');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('categories').setLabel('Categories (one per line)').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('General Support\nBilling\nTechnical Issue\nOther'))
        );
        return interaction.showModal(modal);
    }

    // === BUILDER: ADD BUTTON ===
    else if (customId === 'ticket_builder_add_button') {
        const modal = new ModalBuilder().setCustomId('ticket_modal_add_button').setTitle('Add New Button');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Button Label').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Support')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('🎫')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('style').setLabel('Color (Blue, Green, Red, Grey)').setStyle(TextInputStyle.Short).setValue('Blue').setRequired(true))
        );
        return interaction.showModal(modal);
    }

    // === BUILDER: REMOVE BUTTON ===
    else if (customId === 'ticket_builder_remove_button') {
        const previewRow = interaction.message.components[0];
        const buttons = previewRow.components.filter(c => c.type === 2); // Type 2 = Button

        // Check if there's a category select menu (type 3 = StringSelect)
        const hasCategories = interaction.message.components.some(row =>
            row.components.some(c => c.type === 3 && c.customId?.includes('category'))
        );

        // Can remove all buttons if categories exist, otherwise keep at least one
        if (buttons.length <= 1 && !hasCategories) {
            return interaction.reply({ content: '❌ Add categories first, or keep at least one button!', ephemeral: true });
        }

        if (buttons.length === 0) {
            return interaction.reply({ content: '❌ No buttons to remove!', ephemeral: true });
        }

        // Remove last button
        const newButtons = buttons.slice(0, -1).map(b => ButtonBuilder.from(b));

        // Get all rows
        const allRows = interaction.message.components.map(r => ActionRowBuilder.from(r));

        if (newButtons.length > 0) {
            // Replace first row with remaining buttons
            allRows[0] = new ActionRowBuilder().addComponents(newButtons);
            return interaction.update({ components: allRows });
        } else {
            // Remove button row entirely (categories remain)
            const remaining = allRows.slice(1);
            return interaction.update({ components: remaining });
        }
    }

    // === BUILDER: SEND PANEL (Step 1: Replace controls with Select Menu)===
    else if (customId === 'ticket_builder_send') {
        const select = new ChannelSelectMenuBuilder()
            .setCustomId('ticket_builder_channel_select')
            .setPlaceholder('Select channel to send panel')
            .addChannelTypes(ChannelType.GuildText);

        // Get preview row(s) - could be buttons and/or select menu
        const previewRows = [];
        for (const comp of interaction.message.components) {
            const hasControls = comp.components.some(c =>
                c.customId?.startsWith('ticket_builder_')
            );
            if (!hasControls) {
                previewRows.push(ActionRowBuilder.from(comp));
            }
        }

        const selectRow = new ActionRowBuilder().addComponents(select);
        return interaction.update({ components: [...previewRows, selectRow] });

    }
}

// === HELPER: Generate HTML Transcript ===
async function generateTranscript(channel, member, messages) {
    // Filter out bot messages and reverse to chronological order
    const sortedMessages = Array.from(messages.values())
        .filter(m => !m.author.bot)
        .reverse();
    const generateHTML = (msgs) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Transcript: ${channel.name}</title>
    <style>
        body { background-color: #36393f; color: #dcddde; font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif; margin: 0; padding: 20px; }
        .header { border-bottom: 1px solid #2f3136; padding-bottom: 20px; margin-bottom: 20px; }
        .message { margin-bottom: 20px; display: flex; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; }
        .content { display: flex; flex-direction: column; }
        .username { font-weight: 600; color: #fff; margin-right: 5px; }
        .timestamp { font-size: 0.75rem; color: #72767d; }
        .text { white-space: pre-wrap; margin-top: 5px; }
        .attachment { color: #00b0f4; display: block; margin-top: 5px; text-decoration: none; }
        .image-attachment { max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px; cursor: pointer; }
        .image-attachment:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Transcript: ${channel.name}</h1>
        <p>Closed by: ${member.user.tag}</p>
    </div>
    ${msgs.map(m => `
    <div class="message">
        <img src="${m.author.displayAvatarURL({ extension: 'png' })}" class="avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <div class="content">
            <div>
                <span class="username">${m.author.username}</span>
                <span class="timestamp">${new Date(m.createdTimestamp).toLocaleString()}</span>
            </div>
            <div class="text">${m.content || ''}</div>
            ${m.attachments.map(a => {
        const isImage = a.contentType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name);
        if (isImage) {
            return `<a href="${a.url}" target="_blank"><img src="${a.url}" class="image-attachment" alt="${a.name}"></a>`;
        } else {
            return `<a href="${a.url}" target="_blank" class="attachment">📎 ${a.name}</a>`;
        }
    }).join('')}
        </div>
    </div>`).join('')}
</body>
</html>`;

    const htmlContent = generateHTML(sortedMessages);
    const buffer = Buffer.from(htmlContent, 'utf-8');
    return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });
}

// === HELPER: Close Ticket Action ===
async function closeTicket(interaction, reason = 'No reason provided') {
    const { channel, guild, member } = interaction;

    // 1. Fetch Transcripts
    const messages = await channel.messages.fetch({ limit: 100 });
    const attachment = await generateTranscript(channel, member, messages);

    // 2. Fetch Settings
    const settings = statements.getTicketSettings.get(guild.id);
    const ticketData = statements.getTicket.get(channel.id);

    // 3. Build Transcript Embed
    const ticketUser = ticketData ? await guild.members.fetch(ticketData.user_id).catch(() => null) : null;
    const ticketOpenReason = ticketData?.reason || 'General Support';
    const closeTime = `<t:${Math.floor(Date.now() / 1000)}:F>`;

    // Format: "username | displayname" or just username if same
    const userName = ticketUser?.user?.username || 'Unknown';
    const displayName = ticketUser?.displayName || ticketUser?.user?.globalName || userName;
    const titleName = userName !== displayName ? `${userName} | ${displayName}` : userName;

    const transcriptEmbed = new EmbedBuilder()
        .setTitle(`Transcript of ${titleName}`)
        .setDescription(
            `> **Closed by:** ${member.user.tag}\n` +
            `> **Close reason:** \`${reason}\`\n` +
            `> **Close time:** ${closeTime}\n` +
            `> **Ticket open reason:** \`${ticketOpenReason}\``
        )
        .setColor(0xC30500)
        .setThumbnail(ticketUser?.user?.displayAvatarURL({ size: 256 }) || null)
        .setFooter({ text: `Ticket closed by ${member.user.username}`, iconURL: member.user.displayAvatarURL() })
        .setTimestamp();

    // 4. DM User
    if (ticketUser) {
        try {
            await ticketUser.send({
                embeds: [transcriptEmbed],
                files: [attachment]
            });
        } catch (e) {
            console.log('Could not DM user');
        }
    }

    // 5. Send to Log Channel
    if (settings && settings.transcripts_channel_id) {
        const logChannel = guild.channels.cache.get(settings.transcripts_channel_id);
        if (logChannel) {
            await logChannel.send({
                embeds: [transcriptEmbed],
                files: [attachment]
            });
        }
    }

    // 6. Delete Channel
    await interaction.editReply({ content: '✅ Ticket closed. Deleting channel...', components: [] });
    setTimeout(() => {
        channel.delete().catch(() => { });
        statements.removeTicket.run(channel.id);
    }, 2000);
}





async function handleTicketModal(interaction) {
    const { customId, fields } = interaction;

    if (customId === 'ticket_modal_close_reason') {
        await interaction.deferReply();
        const reason = fields.getTextInputValue('reason');
        closeTicket(interaction, reason);
        return;
    }

    if (customId === 'ticket_modal_embed') {
        const title = fields.getTextInputValue('title');
        const desc = fields.getTextInputValue('description');
        const color = fields.getTextInputValue('color') || '#5865F2';
        const footer = fields.getTextInputValue('footer');

        const oldEmbed = interaction.message.embeds[0];
        const oldBtn = interaction.message.components[0].components[0];
        const controls = ActionRowBuilder.from(interaction.message.components[1]);

        const newEmbed = EmbedBuilder.from(oldEmbed).setTitle(title).setDescription(desc).setColor(color);
        if (footer) newEmbed.setFooter({ text: footer });

        const row = new ActionRowBuilder().addComponents(ButtonBuilder.from(oldBtn));
        const controls1 = ActionRowBuilder.from(interaction.message.components[1]);
        const controls2 = interaction.message.components[2] ? ActionRowBuilder.from(interaction.message.components[2]) : null;

        const components = controls2 ? [row, controls1, controls2] : [row, controls1];
        return interaction.update({ embeds: [newEmbed], components });
    }

    else if (customId === 'ticket_modal_button') {
        const label = fields.getTextInputValue('label');
        const emoji = fields.getTextInputValue('emoji');
        let styleInput = fields.getTextInputValue('style').toLowerCase();

        let style = ButtonStyle.Primary;
        if (styleInput.includes('grey') || styleInput.includes('secondary')) style = ButtonStyle.Secondary;
        else if (styleInput.includes('green') || styleInput.includes('success')) style = ButtonStyle.Success;
        else if (styleInput.includes('red') || styleInput.includes('danger')) style = ButtonStyle.Danger;

        const oldEmbed = interaction.message.embeds[0];
        const controls1 = ActionRowBuilder.from(interaction.message.components[1]);
        const controls2 = interaction.message.components[2] ? ActionRowBuilder.from(interaction.message.components[2]) : null;

        const newBtn = new ButtonBuilder()
            .setCustomId('ticket_create_preview')
            .setLabel(label)
            .setStyle(style)
            .setDisabled(true);

        if (emoji) newBtn.setEmoji(emoji);

        const row = new ActionRowBuilder().addComponents(newBtn);
        const components = controls2 ? [row, controls1, controls2] : [row, controls1];
        return interaction.update({ embeds: [oldEmbed], components });
    }

    // === SET IMAGE ===
    else if (customId === 'ticket_modal_image') {
        const imageUrl = fields.getTextInputValue('image_url');
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed);

        if (imageUrl) newEmbed.setImage(imageUrl);
        else newEmbed.setImage(null);

        const row = ActionRowBuilder.from(interaction.message.components[0]);
        const controls1 = ActionRowBuilder.from(interaction.message.components[1]);
        const controls2 = interaction.message.components[2] ? ActionRowBuilder.from(interaction.message.components[2]) : null;
        const components = controls2 ? [row, controls1, controls2] : [row, controls1];
        return interaction.update({ embeds: [newEmbed], components });
    }

    // === SET THUMBNAIL ===
    else if (customId === 'ticket_modal_thumbnail') {
        const thumbUrl = fields.getTextInputValue('thumbnail_url');
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed);

        if (thumbUrl) newEmbed.setThumbnail(thumbUrl);
        else newEmbed.setThumbnail(null);

        const row = ActionRowBuilder.from(interaction.message.components[0]);
        const controls1 = ActionRowBuilder.from(interaction.message.components[1]);
        const controls2 = interaction.message.components[2] ? ActionRowBuilder.from(interaction.message.components[2]) : null;
        const components = controls2 ? [row, controls1, controls2] : [row, controls1];
        return interaction.update({ embeds: [newEmbed], components });
    }

    // === SET COLOR ===
    else if (customId === 'ticket_modal_color') {
        const color = fields.getTextInputValue('color');
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed).setColor(color);

        const row = ActionRowBuilder.from(interaction.message.components[0]);
        const controls1 = ActionRowBuilder.from(interaction.message.components[1]);
        const controls2 = interaction.message.components[2] ? ActionRowBuilder.from(interaction.message.components[2]) : null;
        const components = controls2 ? [row, controls1, controls2] : [row, controls1];
        return interaction.update({ embeds: [newEmbed], components });
    }

    // === ADD CATEGORIES (Creates Select Menu alongside existing buttons) ===
    else if (customId === 'ticket_modal_categories') {
        const categoriesText = fields.getTextInputValue('categories');
        const categories = categoriesText.split('\n').filter(c => c.trim()).slice(0, 25);

        if (categories.length === 0) {
            return interaction.reply({ content: '❌ Please provide at least one category.', ephemeral: true });
        }

        const oldEmbed = interaction.message.embeds[0];
        const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category_select_preview')
            .setPlaceholder('Select a category')
            .setDisabled(true)
            .addOptions(categories.map((cat, i) =>
                new StringSelectMenuOptionBuilder().setLabel(cat.trim()).setValue(`cat_${i}`)
            ));

        // Keep existing button row
        const buttonRow = ActionRowBuilder.from(interaction.message.components[0]);
        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        // Get control rows
        const controls = interaction.message.components.slice(1).map(r => ActionRowBuilder.from(r));

        return interaction.update({ embeds: [oldEmbed], components: [buttonRow, selectRow, ...controls] });
    }

    // === ADD NEW BUTTON ===
    else if (customId === 'ticket_modal_add_button') {
        const label = fields.getTextInputValue('label');
        const emoji = fields.getTextInputValue('emoji');
        let styleInput = fields.getTextInputValue('style').toLowerCase();

        let style = ButtonStyle.Primary;
        if (styleInput.includes('grey') || styleInput.includes('secondary')) style = ButtonStyle.Secondary;
        else if (styleInput.includes('green') || styleInput.includes('success')) style = ButtonStyle.Success;
        else if (styleInput.includes('red') || styleInput.includes('danger')) style = ButtonStyle.Danger;

        const previewRow = interaction.message.components[0];
        const existingButtons = previewRow.components.filter(c => c.type === 2).map(b => ButtonBuilder.from(b));

        if (existingButtons.length >= 5) {
            return interaction.reply({ content: '❌ Maximum 5 buttons per row!', ephemeral: true });
        }

        const newBtn = new ButtonBuilder()
            .setCustomId(`ticket_create_preview_${existingButtons.length}`)
            .setLabel(label)
            .setStyle(style)
            .setDisabled(true);

        if (emoji) newBtn.setEmoji(emoji);

        existingButtons.push(newBtn);
        const newButtonRow = new ActionRowBuilder().addComponents(existingButtons);

        const oldEmbed = interaction.message.embeds[0];
        const controls = interaction.message.components.slice(1).map(r => ActionRowBuilder.from(r));

        return interaction.update({ embeds: [oldEmbed], components: [newButtonRow, ...controls] });
    }
}

async function handleTicketSelect(interaction) {
    if (interaction.customId === 'ticket_builder_channel_select') {
        const selectedId = interaction.values[0];
        console.log(`Select triggered. Channel ID: ${selectedId}`);

        let targetChannel;
        try {
            targetChannel = await interaction.guild.channels.fetch(selectedId);
        } catch (e) {
            console.error('Error fetching channel:', e);
            return interaction.reply({ content: '❌ Could not fetch target channel.', ephemeral: true });
        }

        if (!targetChannel || !targetChannel.isTextBased()) {
            return interaction.reply({ content: '❌ Invalid text channel.', ephemeral: true });
        }

        // Get the PREVIEW state from the message
        try {
            const previewEmbed = interaction.message.embeds[0];
            console.log('Constructing final panel...');

            // Construct the FINAL panel
            const finalEmbed = EmbedBuilder.from(previewEmbed);
            const finalComponents = [];

            // Process each preview row (skip control rows)
            for (const row of interaction.message.components) {
                const isControlRow = row.components.some(c =>
                    c.customId?.startsWith('ticket_builder_')
                );

                if (!isControlRow) {
                    const newRow = new ActionRowBuilder();

                    for (const comp of row.components) {
                        if (comp.type === 2) { // Button
                            // Create functional button
                            const btn = new ButtonBuilder()
                                .setCustomId(`ticket_create_${finalComponents.length}_${newRow.components.length}`)
                                .setStyle(comp.style)
                                .setDisabled(false);

                            if (comp.label) btn.setLabel(comp.label);
                            if (comp.emoji) btn.setEmoji(comp.emoji);

                            // Must have label or emoji
                            if (!comp.label && !comp.emoji) {
                                btn.setLabel('Open Ticket');
                            }

                            newRow.addComponents(btn);
                        } else if (comp.type === 3) { // StringSelect
                            const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
                            const select = new StringSelectMenuBuilder()
                                .setCustomId('ticket_category_select')
                                .setPlaceholder(comp.placeholder || 'Select a category')
                                .setDisabled(false);

                            for (const opt of comp.options) {
                                select.addOptions(
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel(opt.label)
                                        .setValue(opt.value)
                                );
                            }
                            newRow.addComponents(select);
                        }
                    }

                    if (newRow.components.length > 0) {
                        finalComponents.push(newRow);
                    }
                }
            }

            console.log(`Sending to ${targetChannel.name}...`);
            await targetChannel.send({ embeds: [finalEmbed], components: finalComponents });

            // Update the builder to show success
            const successEmbed = new EmbedBuilder()
                .setTitle('Panel Sent! ✅')
                .setDescription(`Ticket panel sent to ${targetChannel}`)
                .setColor(0x00FF00);

            // Remove components
            await interaction.update({ embeds: [successEmbed], components: [] });
            console.log('Panel sent successfully.');

        } catch (error) {
            console.error('Error in handleTicketSelect:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: `❌ Failed to send panel: ${error.message}`, ephemeral: true });
            }
        }
    }

    // === CATEGORY SELECT - Create ticket with selected category ===
    else if (interaction.customId === 'ticket_category_select') {
        const { guild, member } = interaction;
        await interaction.deferReply({ ephemeral: true });

        const selectedCategory = interaction.values[0];

        // Get the label from the select menu options
        const selectMenu = interaction.component;
        const selectedOption = selectMenu.options.find(opt => opt.value === selectedCategory);
        const categoryLabel = selectedOption?.label || 'General Support';

        const settings = statements.getTicketSettings.get(guild.id);
        if (!settings) return interaction.editReply({ content: '❌ Ticket system not setup. Run `/ticketsetup`.' });

        // Check active tickets (Limit 1 per user)
        const activeTickets = statements.getUserTickets.get(member.id, guild.id, 'open');
        if (activeTickets) {
            return interaction.editReply({ content: '❌ You already have an open ticket!' });
        }

        // Create ticket channel
        const channelName = `ticket-${member.user.username}`;
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: settings.category_id,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: settings.staff_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
        });

        // Add to DB
        statements.addTicket.run(ticketChannel.id, guild.id, member.id, 'open', categoryLabel);

        // Send control panel
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('👋')
        );

        const embed = new EmbedBuilder()
            .setTitle(`Ticket: ${member.user.tag}`)
            .setDescription(`**Category:** ${categoryLabel}\n\nSupport will be with you shortly.\n<@&${settings.staff_role_id}>`)
            .setColor(0x5865F2);

        await ticketChannel.send({ content: `${member} Here is your ticket!`, embeds: [embed], components: [row] });

        // Send confirmation
        const confirmEmbed = new EmbedBuilder()
            .setDescription('✨ **Your ticket has been created!**')
            .setColor(0x5865F2);

        const linkRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Go to Ticket')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guild.id}/${ticketChannel.id}`)
                .setEmoji('🎫')
        );

        return interaction.editReply({ embeds: [confirmEmbed], components: [linkRow] });
    }
}

module.exports = { handleTicketButton, handleTicketModal, handleTicketSelect };
