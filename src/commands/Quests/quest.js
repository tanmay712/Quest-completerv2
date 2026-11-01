const { MessageFlags } = require('discord.js');
const db = require('../../lib/services/database.js');
const questEngine = require('../../lib/services/questEngine.js');
const discordApi = require('../../lib/services/discordApi.js');
const {
    buildAccountNotLinked,
    buildQuestSelectionList,
    buildSolvingQuestCard,
    buildQuestCompletedCard
} = require('../../lib/functions/questUI.js');

function sleep(ms, jitter = 400) {
    const randomJitter = Math.floor(Math.random() * jitter);
    return new Promise(resolve => setTimeout(resolve, ms + randomJitter));
}

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['quest', 'q'],
    desc: 'Pick and complete an individual active quest',
    category: 'Quests',
    cooldown: '5s',
    usage: '.quest [#number / name]   •   /quest [target]',
    detailedDesc: 'Interactively select an uncompleted Discord quest from your account. O R B Y T E simulates the required playtime, stream heartbeat, or video progression. Once completed, claim your reward manually in the Discord app.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link) • Active uncompleted quest on account',
    executionFlow: [
        '1. Validates and decrypts your stored Discord user token',
        '2. Queries Discord /quests/@me API for available active quests',
        '3. Specify a quest number from questlist (e.g. 1) or pick from the dropdown',
        '4. Transmits simulated progress heartbeats to complete criteria',
        '5. Completes quest requirements so you can claim your reward in Discord'
    ],
    examples: [
        '.quest',
        '.quest 1',
        '.quest 18',
        '.quest all',
        '/quest'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);

        // 1. If not linked -> Render Account Not Linked card
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

        // 2. Check if a quest is ALREADY being solved for this user!
        if (questEngine.isSolving(userId) || (user.activeQuest && user.activeQuest.isSolving)) {
            const currentQuestName = user.activeQuest?.title || 'Active Quest';
            const warningMsg = `⚠️ Already solving: **${currentQuestName}**. Run \`.queststatus\` to check progress!`;
            return await message.reply({
                content: warningMsg
            });
        }

        // Fetch user's real quests from Discord API
        const realQuests = await questEngine.fetchAndCacheUserQuests(userId);

        // Context info for stream heartbeat (guild + channel + user)
        const contextInfo = {
            guildId: message.guildId || null,
            channelId: message.channelId || null,
            userId
        };

        // 3. If linked and no args -> Render Quest Selection List with dropdown
        if (args.length === 0) {
            const listData = buildQuestSelectionList(client, user, realQuests);
            let sentMessage = null;
            try {
                sentMessage = await message.reply({
                    components: [listData.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {
                sentMessage = await message.reply({
                    embeds: [listData.fallbackEmbed],
                    components: listData.actionRows
                });
            }

            if (!sentMessage) return;

            // Collector for dropdown selection
            const collector = sentMessage.createMessageComponentCollector({ time: 180_000 });
            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== userId) {
                    return interaction.reply({ content: '❌ This quest selection menu is for another user.', flags: 'Ephemeral' }).catch(() => {});
                }

                if (interaction.customId === 'select_quest_to_solve') {
                    // Check if already solving
                    if (questEngine.isSolving(userId)) {
                        return interaction.reply({
                            content: `⚠️ Already solving: **${user.activeQuest?.title || 'Active Quest'}**. Run \`.queststatus\` to check progress!`,
                            flags: 'Ephemeral'
                        }).catch(() => {});
                    }

                    const pickedNumber = interaction.values[0].replace('quest_pick_', '');
                    const startRes = questEngine.startQuest(userId, pickedNumber);
                    const questObj = startRes.quest;
                    const solvingCard = buildSolvingQuestCard(client, questObj, 0, '0% — Initializing connection...');

                    try {
                        await interaction.update({
                            components: [solvingCard.container],
                            flags: MessageFlags.IsComponentsV2
                        });
                    } catch {
                        await interaction.update({
                            embeds: [solvingCard.fallbackEmbed],
                            components: solvingCard.actionRows
                        }).catch(() => {});
                    }

                    collector.stop();

                    // Start real Discord API automation and live updater
                    attachLiveProgressUpdater(sentMessage, client, userId, activeAccount, questObj, contextInfo);
                }
            });

            return;
        }

        // 4. User passed an argument (e.g. .quest 1 or .quest 18 or .quest <name>) -> Render Solving Quest
        const targetQuery = args.join(' ');
        const startRes = questEngine.startQuest(userId, targetQuery);
        const questObj = startRes.quest;
        const solvingCard = buildSolvingQuestCard(client, questObj, 0, '0% — Initializing connection...');

        let sent = null;
        try {
            sent = await message.reply({
                components: [solvingCard.container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            sent = await message.reply({
                embeds: [solvingCard.fallbackEmbed],
                components: solvingCard.actionRows
            });
        }

        if (sent) {
            attachLiveProgressUpdater(sent, client, userId, activeAccount, questObj, contextInfo);
        }
    }
};

/**
 * Real live updater & background heartbeat worker for Discord Quests
 */
function attachLiveProgressUpdater(sentMessage, client, userId, activeAccount, questObj, contextInfo = {}) {
    const token = activeAccount?.token;
    const isRealAccount = Boolean(token && !activeAccount.isDemo);

    const streamKey = contextInfo.guildId && contextInfo.channelId
        ? `guild:${contextInfo.guildId}:${contextInfo.channelId}:${activeAccount?.id || userId}`
        : `call:${contextInfo.channelId || '0'}:${activeAccount?.id || userId}`;

    const metadata = {
        applicationId: questObj.applicationId,
        trafficMetadataSealed: questObj.trafficMetadataSealed,
        metadataSealed: questObj.metadataSealed
    };

    let isCancelled = false;
    let timerHandle = null;

    // Register active solver in questEngine
    questEngine.registerSolver(userId, {
        quest: questObj,
        cancel: () => {
            isCancelled = true;
            if (timerHandle) clearTimeout(timerHandle);
            questEngine.unregisterSolver(userId);
        }
    });

    db.updateUser(userId, u => {
        if (u.activeQuest) {
            u.activeQuest.isSolving = true;
        }
    });

    // Helper to safely edit the card
    const updateCard = async (percent, statusMessage) => {
        if (isCancelled) return;
        const card = buildSolvingQuestCard(client, questObj, percent, statusMessage);
        try {
            await sentMessage.edit({
                components: [card.container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            await sentMessage.edit({
                embeds: [card.fallbackEmbed],
                components: card.actionRows
            }).catch(() => {});
        }
    };

    // Helper to complete quest
    const finalizeCompletion = async () => {
        questEngine.unregisterSolver(userId);

        if (isRealAccount) {
            try {
                // Auto-claim reward if supported by Discord API
                await discordApi.claimQuestReward(token, questObj.id, metadata).catch(() => {});
                // Re-fetch to refresh user quest status cache
                await questEngine.fetchAndCacheUserQuests(userId).catch(() => {});
            } catch (e) {}
        }

        // Mark quest as completed in local database
        db.updateUser(userId, u => {
            u.activeQuest = null;
            const alreadyCompleted = (u.completedQuests || []).some(q => String(q.id) === String(questObj.id));
            if (!alreadyCompleted) {
                u.completedQuests.push({
                    ...questObj,
                    completedAt: Date.now(),
                    claimed: false
                });
                u.stats.questsCompleted = (u.stats.questsCompleted || 0) + 1;
                u.stats.orbs = (u.stats.orbs || 0) + (questObj.orbsReward || 700);
                u.stats.playtimeMinutes = (u.stats.playtimeMinutes || 0) + (questObj.durationMinutes || 15);
                u.stats.lastCompletedAt = Date.now();
            }
        });

        // Render final completed card
        const completedCard = buildSolvingQuestCard(client, questObj, 100);
        try {
            await sentMessage.edit({
                components: [completedCard.container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            await sentMessage.edit({
                embeds: [completedCard.fallbackEmbed],
                components: completedCard.actionRows
            }).catch(() => {});
        }
    };

    // Cancel collector on the sent message
    const cancelCollector = sentMessage.createMessageComponentCollector({
        filter: i => i.customId === 'btn_cancel_quest',
        time: 1800_000
    });

    cancelCollector.on('collect', async (interaction) => {
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: '❌ You cannot cancel another user\'s quest.', flags: 'Ephemeral' }).catch(() => {});
        }

        isCancelled = true;
        if (timerHandle) clearTimeout(timerHandle);
        questEngine.unregisterSolver(userId);
        questEngine.cancelQuest(userId);
        cancelCollector.stop();

        try {
            await interaction.reply({ content: '🛑 **Quest automation cancelled by user.**', flags: 'Ephemeral' });
        } catch (e) {}

        try {
            await sentMessage.edit({
                content: `🛑 Quest **${questObj.title}** was cancelled.`,
                components: []
            });
        } catch (e) {}
    });

    // EXECUTION BRANCH:
    // A. Video Quests (WATCH_VIDEO / WATCH_VIDEO_ON_MOBILE) -> Rapid & Natural 3-step completion
    if (questObj.taskType === 'WATCH_VIDEO' || questObj.taskType === 'WATCH_VIDEO_ON_MOBILE') {
        (async () => {
            const totalSec = questObj.targetSeconds || 30;
            if (isRealAccount) {
                await discordApi.enrollQuest(token, questObj.id, metadata).catch(() => {});
                await sleep(1500, 400);
            }

            if (isCancelled) return;
            await updateCard(33, '33% — Streaming video contents...');
            if (isRealAccount) {
                await discordApi.sendVideoProgress(token, questObj.id, Math.round(totalSec * 0.35), metadata).catch(() => {});
            }

            await sleep(3500, 800);
            if (isCancelled) return;
            await updateCard(70, '70% — Finalizing video playback...');
            if (isRealAccount) {
                await discordApi.sendVideoProgress(token, questObj.id, Math.round(totalSec * 0.75), metadata).catch(() => {});
            }

            await sleep(3500, 800);
            if (isCancelled) return;
            if (isRealAccount) {
                await discordApi.sendVideoProgress(token, questObj.id, totalSec, metadata).catch(() => {});
            }

            await finalizeCompletion();
            cancelCollector.stop();
        })();
        return;
    }

    // B. Playtime & Stream Quests (PLAY_ON_DESKTOP / STREAM_ON_DESKTOP) -> Real server-side heartbeats
    (async () => {
        const targetSeconds = questObj.targetSeconds || 900;
        let currentValue = questObj.currentProgress || 0;

        if (isRealAccount) {
            // Enroll quest
            await discordApi.enrollQuest(token, questObj.id, metadata).catch(() => {});
            await sleep(1500, 500);

            // Initial heartbeat
            const initHb = await discordApi.sendQuestHeartbeat(token, questObj.id, false, streamKey, metadata).catch(() => null);
            if (initHb?.data?.progress) {
                const pVal = initHb.data.progress[questObj.taskType]?.value ?? initHb.data.stream_progress_seconds;
                if (typeof pVal === 'number') currentValue = pVal;
            }
        }

        const runHeartbeatLoop = async () => {
            if (isCancelled) return;

            const remainingSec = Math.max(0, targetSeconds - currentValue);
            const remainingMins = Math.max(1, Math.ceil(remainingSec / 60));
            const percent = Math.min(99, Math.floor((currentValue / targetSeconds) * 100));

            await updateCard(percent, `${percent}% — ${remainingMins}m remaining...`);

            if (currentValue >= targetSeconds) {
                if (isRealAccount) {
                    await discordApi.sendQuestHeartbeat(token, questObj.id, true, streamKey, metadata).catch(() => {});
                }
                await finalizeCompletion();
                cancelCollector.stop();
                return;
            }

            // Real Discord client heartbeat cadence: 20-25 seconds with human-like jitter
            const nextIntervalMs = 21000 + Math.floor(Math.random() * 4000);

            timerHandle = setTimeout(async () => {
                if (isCancelled) return;

                if (isRealAccount) {
                    const hbRes = await discordApi.sendQuestHeartbeat(token, questObj.id, false, streamKey, metadata).catch(() => null);
                    if (hbRes?.data?.progress) {
                        const sVal = hbRes.data.progress[questObj.taskType]?.value ?? hbRes.data.stream_progress_seconds;
                        if (typeof sVal === 'number' && sVal > currentValue) {
                            currentValue = sVal;
                        } else {
                            currentValue += Math.round(nextIntervalMs / 1000);
                        }
                    } else {
                        currentValue += Math.round(nextIntervalMs / 1000);
                    }
                } else {
                    currentValue += Math.round(nextIntervalMs / 1000);
                }

                // If completed
                if (currentValue >= targetSeconds) {
                    if (isRealAccount) {
                        await discordApi.sendQuestHeartbeat(token, questObj.id, true, streamKey, metadata).catch(() => {});
                    }
                    await finalizeCompletion();
                    cancelCollector.stop();
                    return;
                }

                runHeartbeatLoop();
            }, nextIntervalMs);
        };

        runHeartbeatLoop();
    })();
}
