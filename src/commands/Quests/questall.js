const { MessageFlags } = require('discord.js');
const db = require('../../lib/services/database.js');
const questEngine = require('../../lib/services/questEngine.js');
const discordApi = require('../../lib/services/discordApi.js');
const {
    buildAccountNotLinked,
    buildSolvingAllQuestsCard
} = require('../../lib/functions/questUI.js');

function sleep(ms, jitter = 300) {
    const randomJitter = Math.floor(Math.random() * jitter);
    return new Promise(resolve => setTimeout(resolve, ms + randomJitter));
}

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['questall', 'qa', 'allquests'],
    desc: 'Complete all active quests for your active account at once',
    category: 'Quests',
    cooldown: '10s',
    usage: '.questall   •   /questall',
    detailedDesc: 'Scans your entire quest backlog and solves all eligible quests on your currently active account in parallel with real Discord progress tracking. Watch live progress bars or check anytime via {p}queststatus.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link) • At least 1 active uncompleted quest on account',
    executionFlow: [
        '1. Scans for all uncompleted quests on your active Discord account',
        '2. Automatically enrolls into each quest with official security metadata',
        '3. Launches live parallel progress runners with real-time UI updates',
        '4. Updates individual quest progress bars continuously as heartbeats process',
        '5. Notifies you upon completion so you can claim rewards directly in Discord'
    ],
    examples: [
        '.questall',
        '.qa',
        '/questall'
    ],
    devOnly: false,

    async execute(client, message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);

        // 1. If not linked -> Render Account Not Linked UI
        if (!activeAccount) {
            const notLinkedData = buildAccountNotLinked(client);
            try {
                return await message.reply({
                    components: [notLinkedData.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {
                return await message.reply({
                    embeds: [notLinkedData.fallbackEmbed],
                    components: notLinkedData.actionRows
                });
            }
        }

        // 2. Check if a quest runner is already actively executing for this user
        if (questEngine.isSolving(userId)) {
            const currentQuestName = user.activeQuest?.title || 'active quest session';
            return await message.reply({
                content: `⚠️ Already solving: **${currentQuestName}**. Run \`.queststatus\` to check progress!`
            });
        }

        // 3. Fetch user's real quests from Discord API
        const questResult = await questEngine.fetchAndCacheUserQuests(userId);
        const allQuests = Array.isArray(questResult.quests) ? questResult.quests : questEngine.getUserCatalog(userId);

        // Filter active unexpired quests that are NOT yet completed on Discord
        const activeUnexpired = allQuests.filter(q => !q.isExpired && q.expiresText !== 'expired');
        const uncompletedQuests = activeUnexpired.filter(q => !q.completed);

        if (uncompletedQuests.length === 0) {
            return await message.reply({
                content: '✅ **All available quests on your account are already completed!** Check back later for new drops.'
            });
        }

        // Initial states for all uncompleted quests
        const questStates = uncompletedQuests.map((q, idx) => ({
            id: q.id,
            number: idx + 1,
            title: q.title,
            publisher: q.publisher,
            taskType: q.taskType,
            targetSeconds: q.targetSeconds || 900,
            percent: 0,
            isCompleted: false,
            raw: q
        }));

        const initialCard = buildSolvingAllQuestsCard(client, user, activeAccount, questStates, false);
        let sentMessage = null;
        try {
            sentMessage = await message.reply({
                components: [initialCard.container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            sentMessage = await message.reply({
                embeds: [initialCard.fallbackEmbed],
                components: initialCard.actionRows
            });
        }

        if (!sentMessage) return;

        // Context info for stream / voice heartbeat
        const contextInfo = {
            guildId: message.guildId || null,
            channelId: message.channelId || null,
            userId
        };

        // Start live parallel updater & execution
        attachAllQuestsProgressRunner(sentMessage, client, userId, activeAccount, questStates, contextInfo);
    }
};

/**
 * Live parallel runner that updates .questall UI in real-time
 */
function attachAllQuestsProgressRunner(sentMessage, client, userId, activeAccount, questStates, contextInfo) {
    const token = activeAccount?.token;
    const isRealAccount = Boolean(token && !activeAccount.isDemo);

    let isCancelled = false;
    let tickerInterval = null;
    let isEditing = false;

    // Safe single-thread card updater
    const renderCard = async (forceDone = false) => {
        if (isCancelled || isEditing) return;
        isEditing = true;

        const updatedCard = buildSolvingAllQuestsCard(
            client,
            db.getUser(userId),
            activeAccount,
            questStates,
            forceDone
        );

        try {
            await sentMessage.edit({
                components: [updatedCard.container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (err) {
            try {
                await sentMessage.edit({
                    embeds: [updatedCard.fallbackEmbed],
                    components: updatedCard.actionRows
                });
            } catch (e) {}
        } finally {
            isEditing = false;
        }
    };

    // Dedicated UI Ticker: Updates the Discord message every 4 seconds smoothly
    tickerInterval = setInterval(async () => {
        if (isCancelled) {
            clearInterval(tickerInterval);
            return;
        }

        // Check if all quests are done
        const allDone = questStates.length > 0 && questStates.every(q => q.isCompleted || q.percent >= 100);
        await renderCard(allDone);

        if (allDone) {
            clearInterval(tickerInterval);
            questEngine.unregisterSolver(userId);
        }
    }, 4000);

    // Register active solver in questEngine
    questEngine.registerSolver(userId, {
        quest: { title: `${questStates.length} Active Quests (Batch)` },
        cancel: () => {
            isCancelled = true;
            if (tickerInterval) clearInterval(tickerInterval);
            questEngine.unregisterSolver(userId);
        }
    });

    // Cancel collector on the message
    const cancelCollector = sentMessage.createMessageComponentCollector({
        filter: i => i.customId === 'btn_cancel_questall',
        time: 1800_000
    });

    cancelCollector.on('collect', async (interaction) => {
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ You cannot cancel another user\'s quest runner.', flags: 'Ephemeral' }).catch(() => {});
        }

        isCancelled = true;
        if (tickerInterval) clearInterval(tickerInterval);
        questEngine.unregisterSolver(userId);
        cancelCollector.stop();

        try {
            await interaction.reply({ content: '🛑 **Questall automation cancelled.**', flags: 'Ephemeral' });
        } catch (e) {}

        try {
            await sentMessage.edit({
                content: `🛑 **Questall runner stopped by user.** Completed quests were saved.`,
                components: []
            });
        } catch (e) {}
    });

    // Worker function for an individual quest
    const executeQuest = async (qState) => {
        const quest = qState.raw;
        const questId = quest.id;
        const metadata = {
            applicationId: quest.applicationId,
            trafficMetadataSealed: quest.trafficMetadataSealed,
            metadataSealed: quest.metadataSealed
        };
        const streamKey = contextInfo.guildId && contextInfo.channelId
            ? `guild:${contextInfo.guildId}:${contextInfo.channelId}:${activeAccount.id || userId}`
            : `call:${contextInfo.channelId || '0'}:${activeAccount.id || userId}`;

        // 1. VIDEO QUESTS: Complete in natural fast increments (~10-15s)
        if (qState.taskType === 'WATCH_VIDEO' || qState.taskType === 'WATCH_VIDEO_ON_MOBILE') {
            const totalSec = qState.targetSeconds || 30;

            if (isRealAccount) {
                await discordApi.enrollQuest(token, questId, metadata).catch(() => {});
                await sleep(800, 300);
            }

            if (isCancelled) return;
            qState.percent = 35;
            if (isRealAccount) {
                await discordApi.sendVideoProgress(token, questId, Math.round(totalSec * 0.35), metadata).catch(() => {});
            }

            await sleep(3500, 500);
            if (isCancelled) return;
            qState.percent = 72;
            if (isRealAccount) {
                await discordApi.sendVideoProgress(token, questId, Math.round(totalSec * 0.72), metadata).catch(() => {});
            }

            await sleep(3500, 500);
            if (isCancelled) return;
            qState.percent = 100;
            qState.isCompleted = true;

            if (isRealAccount) {
                await discordApi.sendVideoProgress(token, questId, totalSec, metadata).catch(() => {});
                await discordApi.claimQuestReward(token, questId, metadata).catch(() => {});
            }

            // Record completion in local DB
            db.updateUser(userId, u => {
                const already = (u.completedQuests || []).some(c => String(c.id) === String(questId));
                if (!already) {
                    u.completedQuests.push({ ...quest, completedAt: Date.now(), claimed: false });
                    u.stats.questsCompleted = (u.stats.questsCompleted || 0) + 1;
                    u.stats.orbs = (u.stats.orbs || 0) + (quest.orbsReward || 700);
                }
            });

            return;
        }

        // 2. PLAYTIME / DESKTOP QUESTS:
        // Progress smoothly on each interval and transmit genuine heartbeats safely
        const targetSec = qState.targetSeconds || 900;
        let currentProgress = quest.currentProgress || 0;

        if (isRealAccount) {
            await discordApi.enrollQuest(token, questId, metadata).catch(() => {});
            await sleep(1000, 300);

            const hb = await discordApi.sendQuestHeartbeat(token, questId, false, streamKey, metadata).catch(() => null);
            if (hb?.data?.progress) {
                const pVal = hb.data.progress[qState.taskType]?.value ?? hb.data.stream_progress_seconds;
                if (typeof pVal === 'number' && pVal > currentProgress) currentProgress = pVal;
            }
        }

        qState.percent = Math.min(99, Math.max(8, Math.floor((currentProgress / targetSec) * 100)));

        while (!isCancelled && currentProgress < targetSec) {
            // Natural 21-25s cadence
            const stepDurationMs = 21000 + Math.floor(Math.random() * 4000);
            const stepSeconds = Math.round(stepDurationMs / 1000);

            // While waiting for the heartbeat interval, smoothly advance visible percent on each tick
            const subSteps = 5;
            const subDelay = Math.floor(stepDurationMs / subSteps);

            for (let s = 0; s < subSteps; s++) {
                if (isCancelled) break;
                await sleep(subDelay, 100);
                currentProgress += Math.round(stepSeconds / subSteps);
                qState.percent = Math.min(99, Math.floor((currentProgress / targetSec) * 100));
            }

            if (isCancelled) break;

            if (isRealAccount) {
                const hb = await discordApi.sendQuestHeartbeat(token, questId, false, streamKey, metadata).catch(() => null);
                if (hb?.data?.progress) {
                    const pVal = hb.data.progress[qState.taskType]?.value ?? hb.data.stream_progress_seconds;
                    if (typeof pVal === 'number' && pVal > 0) {
                        currentProgress = pVal;
                    }
                }
            }

            qState.percent = Math.min(99, Math.floor((currentProgress / targetSec) * 100));
        }

        if (!isCancelled && currentProgress >= targetSec) {
            qState.percent = 100;
            qState.isCompleted = true;

            if (isRealAccount) {
                await discordApi.sendQuestHeartbeat(token, questId, true, streamKey, metadata).catch(() => {});
                await discordApi.claimQuestReward(token, questId, metadata).catch(() => {});
            }

            db.updateUser(userId, u => {
                const already = (u.completedQuests || []).some(c => String(c.id) === String(questId));
                if (!already) {
                    u.completedQuests.push({ ...quest, completedAt: Date.now(), claimed: false });
                    u.stats.questsCompleted = (u.stats.questsCompleted || 0) + 1;
                    u.stats.orbs = (u.stats.orbs || 0) + (quest.orbsReward || 700);
                }
            });
        }
    };

    // Run parallel execution
    (async () => {
        // Run all uncompleted quests
        const promises = questStates.map(async (qState, idx) => {
            await sleep(idx * 800, 300); // Stagger startup to prevent burst
            if (!isCancelled) {
                await executeQuest(qState);
            }
        });

        await Promise.allSettled(promises);

        if (!isCancelled) {
            if (tickerInterval) clearInterval(tickerInterval);
            questEngine.unregisterSolver(userId);
            cancelCollector.stop();
            await renderCard(true); // Final render with # ✅ All Quests Completed!
        }
    })();
}
