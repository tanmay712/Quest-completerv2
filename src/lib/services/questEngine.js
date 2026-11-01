const db = require('./database.js');
const discordApi = require('./discordApi.js');

function generateProgressBar(percent) {
    const totalBars = 15;
    const filled = Math.min(totalBars, Math.max(0, Math.round((percent / 100) * totalBars)));
    const empty = totalBars - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

class QuestEngine {
    constructor() {
        this.userQuestsCache = new Map();
        this.activeSolvers = new Map(); // userId -> { quest, cancel() }
    }

    registerSolver(userId, solverHandle) {
        this.activeSolvers.set(userId, solverHandle);
    }

    unregisterSolver(userId) {
        this.activeSolvers.delete(userId);
    }

    isSolving(userId) {
        return this.activeSolvers.has(userId);
    }

    getCatalog() {
        return [];
    }

    /**
     * Fetch user's real quests from Discord and cache them
     */
    async fetchAndCacheUserQuests(userId) {
        const activeAccount = db.getActiveAccount(userId);
        if (!activeAccount || !activeAccount.token || activeAccount.isDemo) {
            return {
                success: false,
                status: 401,
                error: 'NO_ACCOUNT',
                quests: []
            };
        }

        try {
            const res = await discordApi.fetchUserQuests(activeAccount.token);
            if (res.success && Array.isArray(res.quests)) {
                this.userQuestsCache.set(userId, res.quests);
                return {
                    success: true,
                    status: 200,
                    quests: res.quests
                };
            }

            return {
                success: Boolean(res.success),
                status: res.status || 500,
                error: res.error || 'Failed to fetch quests from Discord API',
                quests: this.userQuestsCache.get(userId) || []
            };
        } catch (e) {
            return {
                success: false,
                status: 500,
                error: e.message,
                quests: this.userQuestsCache.get(userId) || []
            };
        }
    }

    /**
     * Get user's active quest list (100% real Discord data)
     */
    getUserCatalog(userId) {
        return this.userQuestsCache.get(userId) || [];
    }

    getQuestByIdOrNumber(userId, query) {
        const list = this.getUserCatalog(userId);
        if (!list || list.length === 0) return null;

        // Filter active unexpired quests first
        const activeList = list.filter(q => !q.isExpired && q.expiresText !== 'expired');
        const searchPool = activeList.length > 0 ? activeList : list;

        if (!query) return searchPool[0];

        const queryStr = String(query).trim();
        // Exact ID match in entire list
        const foundById = list.find(q => String(q.id) === queryStr);
        if (foundById) return foundById;

        const clean = queryStr.replace(/[#\s]/g, '');
        const num = parseInt(clean, 10);
        if (!isNaN(num)) {
            // Check in active pool by 1-based index
            if (num >= 1 && num <= searchPool.length) {
                return searchPool[num - 1];
            }
            const foundByNum = searchPool.find(q => q.number === num);
            if (foundByNum) return foundByNum;
        }

        const lower = queryStr.toLowerCase();
        // Title or publisher match in active pool first
        const foundInActive = searchPool.find(q =>
            q.title.toLowerCase().includes(lower) ||
            (q.publisher && q.publisher.toLowerCase().includes(lower))
        );
        if (foundInActive) return foundInActive;

        // Fallback title match in entire list
        const foundAnywhere = list.find(q =>
            q.title.toLowerCase().includes(lower) ||
            (q.publisher && q.publisher.toLowerCase().includes(lower))
        );

        return foundAnywhere || searchPool[0];
    }

    getQuestStatus(userId) {
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);

        if (!user.activeQuest) {
            return {
                hasActive: false,
                activeAccount,
                user
            };
        }

        const quest = user.activeQuest;
        const now = Date.now();
        const elapsedMs = now - quest.startedAt;
        const totalMs = (quest.durationMinutes || 15) * 60 * 1000;

        if (elapsedMs >= totalMs) {
            const completedQuest = {
                ...quest,
                completedAt: now,
                claimed: false
            };

            db.updateUser(userId, u => {
                u.activeQuest = null;
                u.completedQuests.push(completedQuest);
                u.stats.questsCompleted = (u.stats.questsCompleted || 0) + 1;
                u.stats.orbs = (u.stats.orbs || 0) + (quest.orbsReward || 700);
                u.stats.playtimeMinutes = (u.stats.playtimeMinutes || 0) + (quest.durationMinutes || 15);
                u.stats.lastCompletedAt = now;
            });

            return {
                hasActive: false,
                justCompleted: completedQuest,
                activeAccount,
                user: db.getUser(userId)
            };
        }

        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const remainingMinutes = Math.max(1, (quest.durationMinutes || 15) - elapsedMinutes);
        const percent = Math.min(99, Math.max(0, Math.floor((elapsedMs / totalMs) * 100)));

        return {
            hasActive: true,
            quest,
            elapsedMinutes,
            totalMinutes: quest.durationMinutes || 15,
            remainingMinutes,
            percent,
            progressBar: generateProgressBar(percent),
            activeAccount,
            user
        };
    }

    startQuest(userId, targetQuery) {
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);

        if (!activeAccount) {
            return { error: 'NO_ACCOUNT' };
        }

        const selectedQuest = this.getQuestByIdOrNumber(userId, targetQuery);

        const questData = {
            id: selectedQuest.id,
            number: selectedQuest.number,
            title: selectedQuest.title,
            publisher: selectedQuest.publisher,
            taskDetails: selectedQuest.taskDetails,
            durationMinutes: selectedQuest.durationMinutes,
            expiresText: selectedQuest.expiresText,
            orbsReward: selectedQuest.orbsReward,
            rewardText: selectedQuest.rewardText,
            applicationId: selectedQuest.applicationId,
            taskType: selectedQuest.taskType || 'PLAY_ON_DESKTOP',
            targetSeconds: selectedQuest.targetSeconds || 900,
            startedAt: Date.now()
        };

        db.updateUser(userId, u => {
            u.activeQuest = questData;
        });

        return {
            success: true,
            quest: questData,
            activeAccount
        };
    }

    startBatch(userId) {
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);

        if (!activeAccount) {
            return { error: 'NO_ACCOUNT' };
        }

        const list = this.getUserCatalog(userId);
        const completedIds = (user.completedQuests || []).map(q => q.id);
        const nextQuest = list.find(q => !completedIds.includes(q.id)) || list[0];

        const questData = {
            id: nextQuest.id,
            number: nextQuest.number,
            title: nextQuest.title,
            publisher: nextQuest.publisher,
            taskDetails: nextQuest.taskDetails,
            durationMinutes: nextQuest.durationMinutes,
            expiresText: nextQuest.expiresText,
            orbsReward: nextQuest.orbsReward,
            rewardText: nextQuest.rewardText,
            applicationId: nextQuest.applicationId,
            taskType: nextQuest.taskType || 'PLAY_ON_DESKTOP',
            targetSeconds: nextQuest.targetSeconds || 900,
            startedAt: Date.now(),
            isBatch: true,
            queueCount: list.length
        };

        db.updateUser(userId, u => {
            u.activeQuest = questData;
        });

        return {
            success: true,
            quest: questData,
            activeAccount,
            totalQueued: list.length
        };
    }

    cancelQuest(userId) {
        if (this.activeSolvers.has(userId)) {
            const solver = this.activeSolvers.get(userId);
            if (typeof solver?.cancel === 'function') {
                try { solver.cancel(); } catch (e) {}
            }
            this.activeSolvers.delete(userId);
        }

        const user = db.getUser(userId);
        if (user.activeQuest) {
            db.updateUser(userId, u => {
                u.activeQuest = null;
            });
            return true;
        }
        return false;
    }
}

const questEngine = new QuestEngine();
module.exports = questEngine;
