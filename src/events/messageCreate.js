const { EmbedBuilder } = require('discord.js');
const { statements } = require('../database/db');
const { hasPermission } = require('../handlers/permissionHandler');
const embeds = require('../utils/embeds');
const config = require('../config');

const spamTracker = new Map();
const stickyCooldown = new Map();

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (!message.guild) return;

        // === STICKY (super fast, runs for all messages) ===
        if (message.author.id !== client.user.id) {
            const sticky = statements.getSticky.get(message.channelId);
            if (sticky) {
                const now = Date.now();
                const last = stickyCooldown.get(message.channelId) || 0;
                if (now - last > 2000) {
                    stickyCooldown.set(message.channelId, now);
                    setImmediate(async () => {
                        try {
                            if (sticky.message_id) {
                                const old = await message.channel.messages.fetch(sticky.message_id).catch(() => null);
                                if (old) old.delete().catch(() => { });
                            }

                            let newMsg;
                            if (sticky.is_embed) {
                                newMsg = await message.channel.send({
                                    embeds: [new EmbedBuilder().setDescription(`📌 ${sticky.content}`).setColor(0xFFD700).setFooter({ text: 'Sticky Message' })]
                                });
                            } else {
                                newMsg = await message.channel.send({
                                    content: `**📌 Sticky Message:**\n${sticky.content}`
                                });
                            }

                            statements.updateStickyMessageId.run(newMsg.id, message.channelId);
                        } catch { }
                    });
                }
            }
        }

        if (message.author.bot) return;

        const guildData = statements.getGuild.get(message.guildId);
        const prefix = guildData?.prefix || config.defaultPrefix;

        // === AUTOMOD (cached) ===
        const automod = statements.getAutomod.get(message.guildId);
        if (automod && !hasPermission(message.member, config.permissions.STAFF, message.guildId)) {
            let del = false, reason = '';

            if (automod.block_links && /https?:\/\/[^\s]+/i.test(message.content)) { del = true; reason = 'Links not allowed'; }
            if (automod.block_invites && /(discord\.(gg|io|me|li)|discordapp\.com\/invite)/i.test(message.content)) { del = true; reason = 'Invites not allowed'; }
            if (automod.block_mass_emoji && (message.content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|<a?:\w+:\d+>/gu) || []).length > 10) { del = true; reason = 'Too many emojis'; }
            if (automod.block_mass_mentions && (message.mentions.users.size > 5 || message.mentions.roles.size > 3)) { del = true; reason = 'Too many mentions'; }

            // Block spam (simple rate limiting)
            if (automod.block_spam) {
                const key = `${message.guildId}:${message.author.id}`;
                const now = Date.now();
                const u = spamTracker.get(key) || { c: 0, t: 0, lastWarn: 0 };

                if (now - u.t < 2000) {
                    u.c++;
                    if (u.c > 5) {
                        del = true;
                        reason = 'Stop spamming';
                    }
                } else {
                    u.c = 1;
                }
                u.t = now;
                spamTracker.set(key, u);
            }

            if (del) {
                // Delete immediately
                message.delete().catch(() => { });

                // Rate limit warnings (max 1 warning per 3 seconds)
                const key = `${message.guildId}:${message.author.id}`;
                const u = spamTracker.get(key) || { c: 0, t: 0, lastWarn: 0 };
                const now = Date.now();

                if (now - u.lastWarn > 3000) {
                    u.lastWarn = now;
                    spamTracker.set(key, u);
                    message.channel.send(`${message.author}, ${reason}!`)
                        .then(m => setTimeout(() => m.delete().catch(() => { }), 3000))
                        .catch(() => { });
                }
                return;
            }
        }

        // === BLACKLIST (cached) ===
        const blacklist = statements.getBlacklistWords.all(message.guildId);
        if (blacklist.length > 0) {
            const bypassed = statements.isBlacklistBypassed.get(message.guildId, message.author.id);
            if (!bypassed && !hasPermission(message.member, config.permissions.STAFF, message.guildId)) {
                const lower = message.content.toLowerCase();
                for (const { word } of blacklist) {
                    if (lower.includes(word)) {
                        message.delete().catch(() => { });
                        message.channel.send(`${message.author}, that word is not allowed!`).then(m => setTimeout(() => m.delete().catch(() => { }), 3000));
                        return;
                    }
                }
            }
        }

        // Helper for regex escaping
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // === AUTORESPONDER (cached) ===
        const responders = statements.getAutoresponders.all(message.guildId);
        const lower = message.content.toLowerCase();
        for (const ar of responders) {
            // Use word boundaries to match whole words/phrases only
            const escaped = escapeRegExp(ar.trigger_word.toLowerCase());
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (regex.test(lower)) {
                message.reply(ar.response).catch(() => { });
                break;
            }
        }

        // === AUTOREACT (cached) ===
        const reacts = statements.getAutoreacts.all(message.guildId);
        for (const ar of reacts) {
            const escaped = escapeRegExp(ar.trigger_word.toLowerCase());
            const regex = new RegExp(`\\b${escaped}\\b`, 'i');
            if (regex.test(lower)) message.react(ar.emoji).catch(() => { });
        }

        // === PREFIX COMMANDS ===
        if (!message.content.startsWith(prefix)) return;
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();
        const command = client.commands.get(cmd);
        if (!command) return;

        if (command.permission && !hasPermission(message.member, command.permission, message.guildId)) {
            return message.reply({ embeds: [embeds.error('Permission Denied', 'No permission.')] });
        }

        try {
            await command.execute({
                guild: message.guild, guildId: message.guildId, channel: message.channel, channelId: message.channelId,
                member: message.member, user: message.author, client: client, args, message, isPrefix: true,
                reply: async (o) => { if (typeof o === 'string') return message.reply(o); delete o.ephemeral; return message.reply(o); },
                deferReply: async () => { }, editReply: async (o) => message.reply(o), followUp: async (o) => message.channel.send(o),
                options: {
                    getUser: () => message.mentions.users.first() || null,
                    getMember: () => message.mentions.members.first() || null,
                    getString: () => args.filter(a => !a.startsWith('<@')).join(' ') || null,
                    getInteger: () => { const n = parseInt(args.find(a => !isNaN(parseInt(a)))); return isNaN(n) ? null : n; },
                    getSubcommand: () => args[0]?.toLowerCase() || null,
                    getRole: () => message.mentions.roles.first() || null,
                    getChannel: () => message.mentions.channels.first() || null,
                    getMentionable: () => message.mentions.members.first() || message.mentions.roles.first() || null
                }
            }, client);
        } catch (e) {
            console.error(`Cmd error ${cmd}:`, e);
            message.reply({ embeds: [embeds.error('Error', 'Command failed.')] });
        }
    }
};
