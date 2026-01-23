const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bot_data.json');

// Simple JSON Database Shim
class JSONDatabase {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {
            guilds: [],
            staff_roles: [],
            staff_users: [],
            warnings: [],
            modlogs: [],
            sticky_messages: [],
            autoresponders: [],
            autoreacts: [],
            automod_settings: [],
            blacklist_words: [],
            blacklist_bypass: [],
            vcbans: [],
            vcmute_channels: [],
            tempvc_settings: [],
            active_temp_vcs: [],
            ticket_settings: [],
            tickets: []
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.filePath, 'utf8')) };
            } else {
                this.save();
            }
        } catch (e) {
            console.error('Failed to load DB:', e);
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('Failed to save DB:', e);
        }
    }

    pragma() { } // No-op
    exec() { } // No-op

    prepare(query) {
        return new Statement(this, query);
    }
}

class Statement {
    constructor(db, query) {
        this.db = db;
        this.query = query.trim();
        this.type = this.determineType(this.query);
        this.table = this.extractTable(this.query);
    }

    determineType(q) {
        if (q.startsWith('SELECT')) return 'SELECT';
        if (q.startsWith('INSERT')) return 'INSERT';
        if (q.startsWith('UPDATE')) return 'UPDATE';
        if (q.startsWith('DELETE')) return 'DELETE';
        return 'UNKNOWN';
    }

    extractTable(q) {
        const match = q.match(/(?:FROM|INTO|UPDATE)\s+([a-zA-Z0-9_]+)/i);
        return match ? match[1] : null;
    }

    run(...params) {
        if (!this.table || !this.db.data[this.table]) return { changes: 0, lastInsertRowid: 0 };

        const table = this.db.data[this.table];
        let changes = 0;

        if (this.type === 'INSERT') {
            const row = this.mapInsertParams(this.query, params);
            // Handle ON CONFLICT / REPLACE roughly
            if (this.query.includes('OR REPLACE') || this.query.includes('ON CONFLICT')) {
                // Find potential duplicates based on assumed IDs
                // Simplified: Just add used ID if exists or push
                const existsIdx = table.findIndex(r =>
                    (r.guild_id && r.guild_id === row.guild_id && r.user_id && r.user_id === row.user_id) ||
                    (r.channel_id && r.channel_id === row.channel_id) ||
                    (r.guild_id && r.guild_id === row.guild_id && !r.user_id && !r.channel_id) // Settings tables
                );

                if (existsIdx >= 0) {
                    // Update existing
                    table[existsIdx] = { ...table[existsIdx], ...row };
                } else {
                    row.id = row.id || Date.now() + Math.random(); // Mock ID
                    // Add timestamp if needed
                    if (this.query.includes('created_at')) row.created_at = new Date().toISOString();
                    table.push(row);
                }
            } else {
                row.id = row.id || Date.now() + Math.random();
                table.push(row);
            }
            changes = 1;

        } else if (this.type === 'UPDATE') {
            // Very basic UPDATE support - expects WHERE clause with simple 'field = ?'
            const where = this.parseWhere(this.query, params);
            const updateFields = this.parseUpdateFields(this.query); // This is complex to parse regex-wise without a parser

            // FALLBACK for specific queries we know
            if (this.query.includes('sticky_messages SET message_id')) {
                const target = table.find(r => r.channel_id === params[1]);
                if (target) { target.message_id = params[0]; changes = 1; }
            } else if (this.query.includes('active_temp_vcs SET owner_id')) {
                const target = table.find(r => r.channel_id === params[1]);
                if (target) { target.owner_id = params[0]; changes = 1; }
            } else if (this.query.includes('active_temp_vcs SET is_locked')) {
                const target = table.find(r => r.channel_id === params[1]);
                if (target) { target.is_locked = params[0]; changes = 1; }
            } else if (this.query.includes('tickets SET status')) {
                const target = table.find(r => r.channel_id === params[1]);
                if (target) { target.status = params[0]; changes = 1; }
            }

        } else if (this.type === 'DELETE') {
            // Basic DELETE support
            // Expected: DELETE FROM table WHERE col = ? ...
            if (this.query.includes('WHERE guild_id = ? AND user_id = ?')) {
                const initialLen = table.length;
                this.db.data[this.table] = table.filter(r => !(r.guild_id === params[0] && r.user_id === params[1]));
                changes = initialLen - this.db.data[this.table].length;
            } else if (this.query.includes('WHERE guild_id = ? AND role_id = ?')) {
                const initialLen = table.length;
                this.db.data[this.table] = table.filter(r => !(r.guild_id === params[0] && r.role_id === params[1]));
                changes = initialLen - this.db.data[this.table].length;
            } else if (this.query.includes('WHERE guild_id = ? AND trigger_word = ?')) {
                const initialLen = table.length;
                this.db.data[this.table] = table.filter(r => !(r.guild_id === params[0] && r.trigger_word === params[1]));
                changes = initialLen - this.db.data[this.table].length;
            } else if (this.query.includes('WHERE channel_id = ?')) {
                const initialLen = table.length;
                this.db.data[this.table] = table.filter(r => r.channel_id !== params[0]);
                changes = initialLen - this.db.data[this.table].length;
            } else if (this.query.includes('WHERE guild_id = ? AND word = ?')) {
                const initialLen = table.length;
                this.db.data[this.table] = table.filter(r => !(r.guild_id === params[0] && r.word === params[1]));
                changes = initialLen - this.db.data[this.table].length;
            } else if (this.query.includes('DELETE FROM vcbans WHERE guild_id = ?')) {
                const initialLen = table.length;
                this.db.data[this.table] = table.filter(r => r.guild_id !== params[0]);
                changes = initialLen - this.db.data[this.table].length;
            }
        }

        this.db.save();
        return { changes };
    }

    get(...params) {
        const rows = this.all(...params);
        return rows[0];
    }

    all(...params) {
        if (!this.table || !this.db.data[this.table]) return [];
        const table = this.db.data[this.table];

        // Filter logic
        if (this.query.includes('WHERE guild_id = ?')) {
            // Check for secondary AND
            if (this.query.includes('AND user_id = ?')) {
                // Check for sort
                let res = table.filter(r => r.guild_id === params[0] && r.user_id === params[1]);
                if (this.query.includes('ORDER BY created_at DESC')) res.sort((a, b) => b.created_at - a.created_at || 0); // basic sort
                return res;
            }
            if (this.query.includes('AND status = ?')) {
                return table.filter(r => r.guild_id === params[1] && r.user_id === params[0] && r.status === params[2]); // params order tricky here depending on call
            }
            return table.filter(r => r.guild_id === params[0]);
        }

        if (this.query.includes('WHERE channel_id = ?')) {
            return table.filter(r => r.channel_id === params[0]);
        }

        if (this.query.includes('SELECT * FROM active_temp_vcs')) {
            return table;
        }

        // Default: return all
        return table;
    }

    mapInsertParams(query, params) {
        // Very rough mapper - assumes params match VALUES (?, ?, ?) order
        // We need to parse column names from "INSERT INTO table (col1, col2) VALUES ..."
        const colMatch = query.match(/\((.*?)\)\s+VALUES/i);
        if (!colMatch) return {};
        const cols = colMatch[1].split(',').map(s => s.trim());
        const row = {};
        cols.forEach((col, i) => {
            row[col] = params[i];
        });
        return row;
    }

    // Helper helpers
    parseWhere(query, params) { return null; }
    parseUpdateFields(query) { return null; }
}

const db = new JSONDatabase(dbPath);

// ============ IN-MEMORY CACHE ============
const cache = {
    guilds: new Map(),
    automod: new Map(),
    autoresponders: new Map(),
    autoreacts: new Map(),
    blacklist: new Map(),
    sticky: new Map(),
    vcmute: new Map(),
    tempvc_settings: new Map(),
    active_temp_vcs: new Map(),
    ticket_settings: new Map(),
    TTL: 60000
};

function getCached(map, key, fn) {
    const c = map.get(key);
    if (c && Date.now() - c.t < cache.TTL) return c.d;
    const d = fn();
    map.set(key, { d, t: Date.now() });
    return d;
}

function clearCache(guildId) {
    cache.guilds.delete(guildId);
    cache.automod.delete(guildId);
    cache.autoresponders.delete(guildId);
    cache.autoreacts.delete(guildId);
    cache.blacklist.delete(guildId);
    cache.tempvc_settings.delete(guildId);
    cache.ticket_settings.delete(guildId);
}

// ============ WRAPPER STATEMENTS ============
// This maps the specific queries used in the bot to the JSON DB logic.
// Since the JSONDB class above is generic and imperfect, we will override specific calls here for 100% accuracy.

const statements = {
    // GUILD
    getGuild: { get: (id) => db.data.guilds.find(g => g.guild_id === id) },
    upsertGuild: {
        run: (id, prefix, panel, ip, store) => {
            clearCache(id);
            const idx = db.data.guilds.findIndex(g => g.guild_id === id);
            if (idx >= 0) {
                db.data.guilds[idx] = { ...db.data.guilds[idx], prefix, panel_url: panel, server_ip: ip, store_url: store };
            } else {
                db.data.guilds.push({ guild_id: id, prefix, panel_url: panel, server_ip: ip, store_url: store });
            }
            db.save();
            return { changes: 1 };
        }
    },
    setAutoroleUser: {
        run: (id, role) => {
            clearCache(id);
            const g = db.data.guilds.find(g => g.guild_id === id);
            if (g) g.autorole_user = role;
            else db.data.guilds.push({ guild_id: id, autorole_user: role });
            db.save();
        }
    },
    setAutoroleBot: {
        run: (id, role) => {
            clearCache(id);
            const g = db.data.guilds.find(g => g.guild_id === id);
            if (g) g.autorole_bot = role;
            else db.data.guilds.push({ guild_id: id, autorole_bot: role });
            db.save();
        }
    },
    setVcbanRole: {
        run: (id, role) => {
            clearCache(id);
            const g = db.data.guilds.find(g => g.guild_id === id);
            if (g) g.vcban_role = role;
            else db.data.guilds.push({ guild_id: id, vcban_role: role });
            db.save();
        }
    },

    // STAFF
    addStaffRole: {
        run: (gid, rid, perms) => {
            const idx = db.data.staff_roles.findIndex(r => r.guild_id === gid && r.role_id === rid);
            if (idx >= 0) db.data.staff_roles[idx].permission_level = perms;
            else db.data.staff_roles.push({ guild_id: gid, role_id: rid, permission_level: perms });
            db.save();
        }
    },
    removeStaffRole: {
        run: (gid, rid) => {
            db.data.staff_roles = db.data.staff_roles.filter(r => !(r.guild_id === gid && r.role_id === rid));
            db.save();
        }
    },
    getStaffRoles: { all: (gid) => db.data.staff_roles.filter(r => r.guild_id === gid) },

    addStaffUser: {
        run: (gid, uid, perms) => {
            const idx = db.data.staff_users.findIndex(r => r.guild_id === gid && r.user_id === uid);
            if (idx >= 0) db.data.staff_users[idx].permission_level = perms;
            else db.data.staff_users.push({ guild_id: gid, user_id: uid, permission_level: perms });
            db.save();
        }
    },
    removeStaffUser: {
        run: (gid, uid) => {
            db.data.staff_users = db.data.staff_users.filter(r => !(r.guild_id === gid && r.user_id === uid));
            db.save();
        }
    },
    getStaffUsers: { all: (gid) => db.data.staff_users.filter(r => r.guild_id === gid) },

    // WARNINGS & MODLOGS
    addWarning: {
        run: (gid, uid, mod, reason) => {
            db.data.warnings.push({ guild_id: gid, user_id: uid, moderator_id: mod, reason, created_at: Date.now() });
            db.save();
        }
    },
    getWarnings: { all: (gid, uid) => db.data.warnings.filter(w => w.guild_id === gid && w.user_id === uid).sort((a, b) => b.created_at - a.created_at) },

    addModlog: {
        run: (gid, uid, mod, action, reason, dur) => {
            db.data.modlogs.push({ guild_id: gid, user_id: uid, moderator_id: mod, action, reason, duration: dur, created_at: Date.now() });
            db.save();
        }
    },
    getModlogs: { all: (gid, uid) => db.data.modlogs.filter(w => w.guild_id === gid && w.user_id === uid).sort((a, b) => b.created_at - a.created_at).slice(0, 20) },
    getModlogCounts: {
        all: (gid, uid) => {
            const logs = db.data.modlogs.filter(w => w.guild_id === gid && w.user_id === uid);
            const counts = {};
            logs.forEach(l => counts[l.action] = (counts[l.action] || 0) + 1);
            return Object.entries(counts).map(([action, count]) => ({ action, count }));
        }
    },

    // STICKY
    setSticky: {
        run: (gid, cid, mid, content, is_embed) => {
            cache.sticky.delete(cid);
            const idx = db.data.sticky_messages.findIndex(s => s.channel_id === cid);
            if (idx >= 0) {
                db.data.sticky_messages[idx] = { ...db.data.sticky_messages[idx], message_id: mid, content, is_embed };
            } else {
                db.data.sticky_messages.push({ guild_id: gid, channel_id: cid, message_id: mid, content, is_embed });
            }
            db.save();
        }
    },
    getSticky: { get: (cid) => getCached(cache.sticky, cid, () => db.data.sticky_messages.find(s => s.channel_id === cid)) },
    removeSticky: {
        run: (cid) => {
            cache.sticky.delete(cid);
            db.data.sticky_messages = db.data.sticky_messages.filter(s => s.channel_id !== cid);
            db.save();
        }
    },
    updateStickyMessageId: {
        run: (mid, cid) => {
            cache.sticky.delete(cid);
            const s = db.data.sticky_messages.find(s => s.channel_id === cid);
            if (s) { s.message_id = mid; db.save(); }
        }
    },

    // AUTOMOD, AUTORESPONDER, AUTOREACT
    addAutoresponder: {
        run: (gid, trig, resp) => {
            cache.autoresponders.delete(gid);
            const idx = db.data.autoresponders.findIndex(a => a.guild_id === gid && a.trigger_word === trig);
            if (idx >= 0) db.data.autoresponders[idx].response = resp;
            else db.data.autoresponders.push({ guild_id: gid, trigger_word: trig, response: resp });
            db.save();
        }
    },
    removeAutoresponder: {
        run: (gid, trig) => {
            cache.autoresponders.delete(gid);
            db.data.autoresponders = db.data.autoresponders.filter(a => !(a.guild_id === gid && a.trigger_word === trig));
            db.save();
        }
    },
    getAutoresponders: { all: (gid) => getCached(cache.autoresponders, gid, () => db.data.autoresponders.filter(a => a.guild_id === gid)) },

    addAutoreact: {
        run: (gid, trig, emoji) => {
            cache.autoreacts.delete(gid);
            const idx = db.data.autoreacts.findIndex(a => a.guild_id === gid && a.trigger_word === trig);
            if (idx >= 0) db.data.autoreacts[idx].emoji = emoji;
            else db.data.autoreacts.push({ guild_id: gid, trigger_word: trig, emoji });
            db.save();
        }
    },
    removeAutoreact: {
        run: (gid, trig) => {
            cache.autoreacts.delete(gid);
            db.data.autoreacts = db.data.autoreacts.filter(a => !(a.guild_id === gid && a.trigger_word === trig));
            db.save();
        }
    },
    getAutoreacts: { all: (gid) => getCached(cache.autoreacts, gid, () => db.data.autoreacts.filter(a => a.guild_id === gid)) },

    setAutomod: {
        run: (gid, links, invites, spam, emoji, mentions) => {
            cache.automod.delete(gid);
            const idx = db.data.automod_settings.findIndex(a => a.guild_id === gid);
            if (idx >= 0) {
                db.data.automod_settings[idx] = { ...db.data.automod_settings[idx], block_links: links, block_invites: invites, block_spam: spam, block_mass_emoji: emoji, block_mass_mentions: mentions };
            } else {
                db.data.automod_settings.push({ guild_id: gid, block_links: links, block_invites: invites, block_spam: spam, block_mass_emoji: emoji, block_mass_mentions: mentions });
            }
            db.save();
        }
    },
    getAutomod: { get: (gid) => getCached(cache.automod, gid, () => db.data.automod_settings.find(a => a.guild_id === gid)) },

    // BLACKLIST
    addBlacklistWord: {
        run: (gid, word) => {
            cache.blacklist.delete(gid);
            if (!db.data.blacklist_words.find(w => w.guild_id === gid && w.word === word)) {
                db.data.blacklist_words.push({ guild_id: gid, word });
                db.save();
            }
        }
    },
    removeBlacklistWord: {
        run: (gid, word) => {
            cache.blacklist.delete(gid);
            db.data.blacklist_words = db.data.blacklist_words.filter(w => !(w.guild_id === gid && w.word === word));
            db.save();
        }
    },
    getBlacklistWords: { all: (gid) => getCached(cache.blacklist, gid, () => db.data.blacklist_words.filter(w => w.guild_id === gid)) },

    // VC BANS
    addVcban: {
        run: (gid, uid, mod, reason) => {
            const idx = db.data.vcbans.findIndex(v => v.guild_id === gid && v.user_id === uid);
            if (idx >= 0) db.data.vcbans[idx] = { guild_id: gid, user_id: uid, moderator_id: mod, reason };
            else db.data.vcbans.push({ guild_id: gid, user_id: uid, moderator_id: mod, reason });
            db.save();
        }
    },
    removeVcban: {
        run: (gid, uid) => {
            db.data.vcbans = db.data.vcbans.filter(v => !(v.guild_id === gid && v.user_id === uid));
            db.save();
        }
    },
    getVcban: { get: (gid, uid) => db.data.vcbans.find(v => v.guild_id === gid && v.user_id === uid) },
    getVcbans: { all: (gid) => db.data.vcbans.filter(v => v.guild_id === gid) },
    clearVcbans: { run: (gid) => { db.data.vcbans = db.data.vcbans.filter(v => v.guild_id !== gid); db.save(); } },

    addVcmuteChannel: {
        run: (gid, cid) => {
            cache.vcmute.delete(cid);
            if (!db.data.vcmute_channels.find(c => c.channel_id === cid)) {
                db.data.vcmute_channels.push({ guild_id: gid, channel_id: cid });
                db.save();
            }
        }
    },
    removeVcmuteChannel: {
        run: (cid) => {
            cache.vcmute.delete(cid);
            db.data.vcmute_channels = db.data.vcmute_channels.filter(c => c.channel_id !== cid);
            db.save();
        }
    },
    getVcmuteChannel: { get: (cid) => getCached(cache.vcmute, cid, () => db.data.vcmute_channels.find(c => c.channel_id === cid)) },

    // TEMP VC
    setTempVcSettings: {
        run: (gid, cat, join, int) => {
            cache.tempvc_settings.delete(gid);
            const idx = db.data.tempvc_settings.findIndex(s => s.guild_id === gid);
            if (idx >= 0) db.data.tempvc_settings[idx] = { ...db.data.tempvc_settings[idx], category_id: cat, join_channel_id: join, interface_channel_id: int };
            else db.data.tempvc_settings.push({ guild_id: gid, category_id: cat, join_channel_id: join, interface_channel_id: int });
            db.save();
        }
    },
    getTempVcSettings: { get: (gid) => getCached(cache.tempvc_settings, gid, () => db.data.tempvc_settings.find(s => s.guild_id === gid)) },

    addActiveTempVc: {
        run: (cid, gid, owner) => {
            cache.active_temp_vcs.delete(cid);
            const idx = db.data.active_temp_vcs.findIndex(a => a.channel_id === cid);
            if (idx >= 0) db.data.active_temp_vcs[idx] = { ...db.data.active_temp_vcs[idx], owner_id: owner };
            else db.data.active_temp_vcs.push({ channel_id: cid, guild_id: gid, owner_id: owner, is_locked: 0, trusted_users: [] });
            db.save();
        }
    },
    removeActiveTempVc: {
        run: (cid) => {
            cache.active_temp_vcs.delete(cid);
            db.data.active_temp_vcs = db.data.active_temp_vcs.filter(a => a.channel_id !== cid);
            db.save();
        }
    },
    getActiveTempVc: { get: (cid) => getCached(cache.active_temp_vcs, cid, () => db.data.active_temp_vcs.find(a => a.channel_id === cid)) },
    getAllActiveTempVcs: { all: () => db.data.active_temp_vcs },
    updateTempVcOwner: {
        run: (owner, cid) => {
            cache.active_temp_vcs.delete(cid);
            const a = db.data.active_temp_vcs.find(a => a.channel_id === cid);
            if (a) { a.owner_id = owner; db.save(); }
        }
    },
    updateTempVcLock: {
        run: (locked, cid) => {
            cache.active_temp_vcs.delete(cid);
            const a = db.data.active_temp_vcs.find(a => a.channel_id === cid);
            if (a) { a.is_locked = locked; db.save(); }
        }
    },
    addTempVcTrust: {
        run: (cid, uid) => {
            cache.active_temp_vcs.delete(cid);
            const a = db.data.active_temp_vcs.find(a => a.channel_id === cid);
            if (a) {
                if (!a.trusted_users) a.trusted_users = [];
                if (!a.trusted_users.includes(uid)) {
                    a.trusted_users.push(uid);
                    db.save();
                }
            }
        }
    },
    removeTempVcTrust: {
        run: (cid, uid) => {
            cache.active_temp_vcs.delete(cid);
            const a = db.data.active_temp_vcs.find(a => a.channel_id === cid);
            if (a && a.trusted_users) {
                a.trusted_users = a.trusted_users.filter(id => id !== uid);
                db.save();
            }
        }
    },

    // TICKETS
    setTicketSettings: {
        run: (gid, cat, trans, staff, panel) => {
            cache.ticket_settings.delete(gid);
            const idx = db.data.ticket_settings.findIndex(t => t.guild_id === gid);
            if (idx >= 0) db.data.ticket_settings[idx] = { ...db.data.ticket_settings[idx], category_id: cat, transcripts_channel_id: trans, staff_role_id: staff, panel_json: panel };
            else db.data.ticket_settings.push({ guild_id: gid, category_id: cat, transcripts_channel_id: trans, staff_role_id: staff, panel_json: panel });
            db.save();
        }
    },
    getTicketSettings: { get: (gid) => getCached(cache.ticket_settings, gid, () => db.data.ticket_settings.find(t => t.guild_id === gid)) },

    addTicket: {
        run: (cid, gid, uid, status, topic) => {
            const idx = db.data.tickets.findIndex(t => t.channel_id === cid);
            if (idx >= 0) db.data.tickets[idx] = { ...db.data.tickets[idx], status, topic };
            else db.data.tickets.push({ channel_id: cid, guild_id: gid, user_id: uid, status, topic, created_at: Date.now() });
            db.save();
        }
    },
    getTicket: { get: (cid) => db.data.tickets.find(t => t.channel_id === cid) },
    getUserTickets: {
        all: (uid, gid, status) => db.data.tickets.filter(t => t.user_id === uid && t.guild_id === gid && t.status === status),
        get: (uid, gid, status) => db.data.tickets.find(t => t.user_id === uid && t.guild_id === gid && t.status === status)
    },
    updateTicketStatus: {
        run: (status, cid) => {
            const t = db.data.tickets.find(t => t.channel_id === cid);
            if (t) { t.status = status; db.save(); }
        }
    },
    removeTicket: {
        run: (cid) => {
            db.data.tickets = db.data.tickets.filter(t => t.channel_id !== cid);
            db.save();
        }
    },

    // BLACKLIST BYPASS
    addBlacklistBypass: {
        run: (gid, uid) => {
            if (!db.data.blacklist_bypass.find(b => b.guild_id === gid && b.user_id === uid)) {
                db.data.blacklist_bypass.push({ guild_id: gid, user_id: uid });
                db.save();
            }
        }
    },
    removeBlacklistBypass: {
        run: (gid, uid) => {
            db.data.blacklist_bypass = db.data.blacklist_bypass.filter(b => !(b.guild_id === gid && b.user_id === uid));
            db.save();
        }
    },
    isBlacklistBypassed: { get: (gid, uid) => db.data.blacklist_bypass.find(b => b.guild_id === gid && b.user_id === uid) },
    getBlacklistBypass: { all: (gid) => db.data.blacklist_bypass.filter(b => b.guild_id === gid) }
};

module.exports = { db, statements, clearCache };
