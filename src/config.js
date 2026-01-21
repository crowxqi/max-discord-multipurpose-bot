require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    ownerId: process.env.OWNER_ID,
    defaultPrefix: process.env.DEFAULT_PREFIX || '!',

    // Bot settings
    embedColor: 0x00D4FF, // Arctic blue
    errorColor: 0xFF4444,
    successColor: 0x44FF44,
    warningColor: 0xFFAA00,

    // Permission levels
    permissions: {
        OWNER: 3,
        ADMIN: 2,
        STAFF: 1,
        ALL: 0
    }
};
