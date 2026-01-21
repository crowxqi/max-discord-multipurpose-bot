const { statements } = require('../database/db');
const config = require('../config');

// In-memory cache for faster permission lookups
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get cached data or fetch from database
 */
function getCached(key, fetchFn) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    const data = fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
}

/**
 * Clear cache for a guild
 */
function clearGuildCache(guildId) {
    for (const key of cache.keys()) {
        if (key.startsWith(guildId)) {
            cache.delete(key);
        }
    }
}

/**
 * Get user's permission level in a guild
 * Returns: 3 = Owner, 2 = Admin, 1 = Staff, 0 = Normal
 */
function getPermissionLevel(member, guildId) {
    // Bot owner has highest permission
    if (member.id === config.ownerId) {
        return config.permissions.OWNER;
    }

    // Server owner has owner permission
    if (member.id === member.guild.ownerId) {
        return config.permissions.OWNER;
    }

    // Discord Administrator permission = Admin
    if (member.permissions.has('Administrator')) {
        return config.permissions.ADMIN;
    }

    // Check if user is a staff user
    const staffUsers = getCached(`${guildId}:staff_users`, () => {
        return statements.getStaffUsers.all(guildId);
    });

    const staffUser = staffUsers.find(u => u.user_id === member.id);
    if (staffUser) {
        return staffUser.permission_level;
    }

    // Check if user has a staff role
    const staffRoles = getCached(`${guildId}:staff_roles`, () => {
        return statements.getStaffRoles.all(guildId);
    });

    let highestLevel = 0;
    for (const staffRole of staffRoles) {
        if (member.roles.cache.has(staffRole.role_id)) {
            highestLevel = Math.max(highestLevel, staffRole.permission_level);
        }
    }

    return highestLevel;
}

/**
 * Check if user has required permission level
 */
function hasPermission(member, requiredLevel, guildId) {
    const userLevel = getPermissionLevel(member, guildId);
    return userLevel >= requiredLevel;
}

/**
 * Get permission level name
 */
function getPermissionName(level) {
    switch (level) {
        case 3: return 'Owner';
        case 2: return 'Admin';
        case 1: return 'Staff';
        default: return 'User';
    }
}

module.exports = {
    getPermissionLevel,
    hasPermission,
    getPermissionName,
    clearGuildCache
};
