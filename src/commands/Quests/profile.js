const { MessageFlags } = require('discord.js');
const db = require('../../lib/services/database.js');
const {
    buildAccountNotLinked,
    buildQuestProfileCard
} = require('../../lib/functions/questUI.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['profile', 'stats', 'me'],
    desc: 'View your active linked account profile, Orbs & stats',
    category: 'Quests',
    cooldown: '3s',
    usage: '.profile [@user]   •   /profile [user]',
    detailedDesc: "Displays your active linked Discord account's personal quest card with its live avatar, display name, total quests solved, Orbs accumulated, Nitro duration earned, and time saved.",
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link)',
    executionFlow: [
        "1. Resolves target user's active linked Discord account from secure vault",
        '2. Fetches live Discord user profile details (avatar, username, global name)',
        '3. Calculates lifetime Orbs, Nitro days, and playtime saved for this specific account',
        '4. Renders formatted Components V2 player card'
    ],
    examples: [
        '.profile',
        '.stats',
        '/profile'
    ],
    devOnly: false,

    async execute(client, message) {
        const targetMember = message.mentions.users.first() || message.author;
        const targetId = targetMember.id;
        const user = db.getUser(targetId);
        const activeAccount = db.getActiveAccount(targetId);

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

        // 2. Render Quest Profile UI matching user screenshot
        const profileCard = buildQuestProfileCard(client, user, activeAccount, targetMember);

        try {
            await message.reply({
                components: [profileCard.container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            await message.reply({
                embeds: [profileCard.fallbackEmbed]
            });
        }
    }
};
