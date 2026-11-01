const { MessageFlags } = require('discord.js');
const db = require('../../lib/services/database.js');
const { buildLeaderboardCard } = require('../../lib/functions/questUI.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['leaderboard', 'top', 'lb'],
    desc: 'Global leaderboard of top quest solving accounts',
    category: 'Quests',
    cooldown: '5s',
    usage: '.leaderboard   •   /leaderboard',
    detailedDesc: 'Displays a ranked, paginated leaderboard of all linked Discord accounts, ranked by total quests completed and Orbs earned. Multi-account slots are tracked and ranked individually.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'None',
    executionFlow: [
        '1. Scans all linked accounts against global quest stats store',
        '2. Ranks each linked account individually by total quests completed',
        '3. Renders interactive paginated leaderboard card with rank medals'
    ],
    examples: [
        '.leaderboard',
        '.top',
        '/leaderboard'
    ],
    devOnly: false,

    async execute(client, message, args) {
        // Collect all linked accounts from database
        const accountsList = [];
        const users = Object.values(db.data.users || {});

        users.forEach(u => {
            const slots = u.slots || {};
            Object.keys(slots).forEach(slotKey => {
                const acc = slots[slotKey];
                if (acc && acc.token) {
                    const questsCount = (u.completedQuests || []).length || u.stats?.questsCompleted || 0;
                    const orbsCount = u.stats?.orbs || (questsCount * 350) || 0;

                    accountsList.push({
                        accountName: acc.globalName || acc.username || `User ${u.userId}`,
                        quests: questsCount,
                        orbs: orbsCount,
                        ownerId: u.userId,
                        slot: Number(slotKey)
                    });
                }
            });
        });

        // Sort descending by quests completed then Orbs (100% REAL linked accounts)
        accountsList.sort((a, b) => (b.quests - a.quests) || (b.orbs - a.orbs));

        let currentPage = 1;
        const requestedPage = parseInt(args[0], 10);
        if (!isNaN(requestedPage) && requestedPage > 0) {
            currentPage = requestedPage;
        }

        const initialCard = buildLeaderboardCard(client, accountsList, currentPage, 10);

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

        // Interactive Pagination Collector (5 minutes)
        const collector = sentMessage.createMessageComponentCollector({
            filter: i => i.customId.startsWith('btn_lb_'),
            time: 300_000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: '❌ This leaderboard menu is for another user.', flags: 'Ephemeral' }).catch(() => {});
            }

            const totalPages = Math.max(1, Math.ceil(accountsList.length / 10));

            if (interaction.customId === 'btn_lb_first') {
                currentPage = 1;
            } else if (interaction.customId === 'btn_lb_prev') {
                currentPage = Math.max(1, currentPage - 1);
            } else if (interaction.customId === 'btn_lb_next') {
                currentPage = Math.min(totalPages, currentPage + 1);
            } else if (interaction.customId === 'btn_lb_last') {
                currentPage = totalPages;
            }

            const updatedCard = buildLeaderboardCard(client, accountsList, currentPage, 10);

            try {
                await interaction.update({
                    components: [updatedCard.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {
                await interaction.update({
                    embeds: [updatedCard.fallbackEmbed],
                    components: updatedCard.actionRows
                }).catch(() => {});
            }
        });

        collector.on('end', async () => {
            try {
                const expiredCard = buildLeaderboardCard(client, accountsList, currentPage, 10);
                expiredCard.actionRows[0].components.forEach(btn => btn.setDisabled(true));
                await sentMessage.edit({
                    components: [expiredCard.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (e) {}
        });
    }
};
