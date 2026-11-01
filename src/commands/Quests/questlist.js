const { MessageFlags } = require('discord.js');
const db = require('../../lib/services/database.js');
const questEngine = require('../../lib/services/questEngine.js');
const {
    buildAccountNotLinked,
    buildQuestListCard
} = require('../../lib/functions/questUI.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['questlist', 'ql', 'quests'],
    desc: 'View all active quests, deadlines & progress',
    category: 'Quests',
    cooldown: '3s',
    usage: '.questlist   •   /questlist',
    detailedDesc: 'Displays an interactive paginated dashboard of all Discord quests on your account, showing completion status, expiration countdowns, and orb rewards.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link)',
    executionFlow: [
        '1. Queries the Discord /quests/@me endpoint with your token',
        '2. Formats all active and historical quests with live completion badges',
        '3. Renders interactive paginated card with [First], [Back], [Next], [Last] controls'
    ],
    examples: [
        '.questlist',
        '.ql',
        '/questlist'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const userId = message.author.id;
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

        // 2. Fetch user's real quests
        const questResult = await questEngine.fetchAndCacheUserQuests(userId);
        const allQuests = Array.isArray(questResult.quests) && questResult.quests.length > 0
            ? questResult.quests
            : questEngine.getUserCatalog(userId);

        let currentPage = 1;
        const requestedPage = parseInt(args[0], 10);
        if (!isNaN(requestedPage) && requestedPage > 0) {
            currentPage = requestedPage;
        }

        const initialCard = buildQuestListCard(client, allQuests, currentPage, 4);

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

        // 3. Pagination Collector (5 minutes)
        const collector = sentMessage.createMessageComponentCollector({
            filter: i => i.customId.startsWith('btn_questlist_'),
            time: 300_000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: '❌ This quest menu is for another user.', flags: 'Ephemeral' }).catch(() => {});
            }

            const totalPages = Math.max(1, Math.ceil(allQuests.length / 4));

            if (interaction.customId === 'btn_questlist_first') {
                currentPage = 1;
            } else if (interaction.customId === 'btn_questlist_back') {
                currentPage = Math.max(1, currentPage - 1);
            } else if (interaction.customId === 'btn_questlist_next') {
                currentPage = Math.min(totalPages, currentPage + 1);
            } else if (interaction.customId === 'btn_questlist_last') {
                currentPage = totalPages;
            }

            const updatedCard = buildQuestListCard(client, allQuests, currentPage, 4);

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
                // Disable pagination buttons when collector expires
                const expiredCard = buildQuestListCard(client, allQuests, currentPage, 4);
                expiredCard.actionRows[0].components.forEach(btn => btn.setDisabled(true));
                await sentMessage.edit({
                    components: [expiredCard.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (e) {}
        });
    }
};
