const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(process.cwd(), 'src/data/store.json');

class Database {
    constructor() {
        this.data = {
            users: {},
            guilds: {}
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const raw = fs.readFileSync(DATA_FILE, 'utf8');
                this.data = JSON.parse(raw);
            } else {
                this.save();
            }
        } catch (err) {
            console.error('Error loading database store:', err);
            this.data = { users: {}, guilds: {} };
        }
    }

    save() {
        try {
            const dir = path.dirname(DATA_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (err) {
            console.error('Error saving database store:', err);
        }
    }

    // User Operations
    getUser(userId) {
        if (!this.data.users[userId]) {
            this.data.users[userId] = {
                userId,
                activeSlot: 1,
                slots: {
                    "1": null,
                    "2": null,
                    "3": null
                },
                stats: {
                    questsCompleted: 0,
                    orbs: 0,
                    playtimeMinutes: 0,
                    streak: 0,
                    lastCompletedAt: null
                },
                activeQuest: null,
                completedQuests: [],
                autoQuest: false
            };
            this.save();
        }
        return this.data.users[userId];
    }

    updateUser(userId, updater) {
        const user = this.getUser(userId);
        if (typeof updater === 'function') {
            updater(user);
        } else {
            Object.assign(user, updater);
        }
        this.save();
        return user;
    }

    getActiveAccount(userId) {
        const user = this.getUser(userId);
        const slot = user.activeSlot || 1;
        return user.slots[String(slot)] || null;
    }

    linkAccount(userId, slotNumber, accountData) {
        const user = this.getUser(userId);
        const slotKey = String(slotNumber);
        user.slots[slotKey] = {
            ...accountData,
            linkedAt: Date.now()
        };
        user.activeSlot = slotNumber;
        this.save();
        return user;
    }

    unlinkAccount(userId, slotNumber) {
        const user = this.getUser(userId);
        const slotKey = String(slotNumber);
        if (user.slots[slotKey]) {
            user.slots[slotKey] = null;
            // If active slot was unlinked, find another linked slot
            if (user.activeSlot === slotNumber) {
                const available = Object.keys(user.slots).find(k => user.slots[k] !== null);
                user.activeSlot = available ? Number(available) : 1;
            }
            this.save();
            return true;
        }
        return false;
    }

    switchActiveSlot(userId, slotNumber) {
        const user = this.getUser(userId);
        user.activeSlot = slotNumber;
        this.save();
        return user;
    }

    // Leaderboard
    getLeaderboard(limit = 10) {
        const users = Object.values(this.data.users);
        return users
            .filter(u => u.stats && (u.stats.questsCompleted > 0 || u.stats.orbs > 0))
            .sort((a, b) => (b.stats.questsCompleted - a.stats.questsCompleted) || (b.stats.orbs - a.stats.orbs))
            .slice(0, limit);
    }

    // Guild Configuration
    getGuild(guildId) {
        if (!this.data.guilds[guildId]) {
            this.data.guilds[guildId] = {
                guildId,
                alertChannelId: null,
                alertRoleId: null,
                authorizedRoleId: null
            };
            this.save();
        }
        return this.data.guilds[guildId];
    }

    updateGuild(guildId, updater) {
        const guild = this.getGuild(guildId);
        if (typeof updater === 'function') {
            updater(guild);
        } else {
            Object.assign(guild, updater);
        }
        this.save();
        return guild;
    }
}

const db = new Database();
module.exports = db;

