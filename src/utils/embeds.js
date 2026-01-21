const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Create a success embed
 */
function success(title, description) {
    return new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create an error embed
 */
function error(title, description) {
    return new EmbedBuilder()
        .setColor(config.errorColor)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create an info embed
 */
function info(title, description) {
    return new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create a warning embed
 */
function warning(title, description) {
    return new EmbedBuilder()
        .setColor(config.warningColor)
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create a moderation embed
 */
function moderation(action, user, moderator, reason, duration = null) {
    const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`🔨 ${action}`)
        .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: `${moderator.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false }
        )
        .setTimestamp();

    if (duration) {
        embed.addFields({ name: 'Duration', value: duration, inline: true });
    }

    return embed;
}

/**
 * Create a status embed for server
 */
function serverStatus(guildName, data) {
    return new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`🌐 ${guildName} - Server Status`)
        .addFields(
            { name: '📊 Panel', value: data.panel || 'Not configured', inline: true },
            { name: '🌍 IP', value: data.ip || 'Not configured', inline: true },
            { name: '🛒 Store', value: data.store || 'Not configured', inline: true }
        )
        .setTimestamp();
}

/**
 * Create a modlog list embed
 */
function modlogList(user, logs) {
    const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`📋 Moderation History ${user ? `for ${user.tag}` : ''}`)
        .setTimestamp();

    if (logs.length === 0) {
        embed.setDescription('No moderation history found.');
    } else {
        const logText = logs.slice(0, 10).map((log, i) => {
            const date = new Date(log.created_at).toLocaleDateString();
            return `**${i + 1}.** \`${log.action}\` - ${log.reason || 'No reason'} (${date})`;
        }).join('\n');
        embed.setDescription(logText);
    }

    return embed;
}

module.exports = {
    success,
    error,
    info,
    warning,
    moderation,
    serverStatus,
    modlogList
};
