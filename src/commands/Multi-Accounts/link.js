const { MessageFlags } = require('discord.js');
const db = require('../../lib/services/database.js');
const discordApi = require('../../lib/services/discordApi.js');
const {
    buildAccountAuthorization,
    buildAccountLinkedSuccess
} = require('../../lib/functions/questUI.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['link', 'addaccount'],
    desc: 'Link up to 3 Discord accounts & switch active slots',
    category: 'Multi-Accounts',
    cooldown: '10s',
    usage: '.link [token]   •   /link [token]',
    detailedDesc: 'Securely link up to 3 Discord accounts to your profile. Allows seamless switching between account slots for automated quest streaming, badge management, and presence controls.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Discord User Token • Always send in DMs for security',
    executionFlow: [
        '1. Validates and tests token authorization against Discord API',
        '2. Encrypts token using AES-256-GCM before saving into account slot',
        '3. Sets newly linked account as active session slot',
        '4. Instantly queries active quests and badges for the account'
    ],
    examples: [
        '.link',
        '.link [token in DM]',
        '/link'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const userId = message.author.id;
        const user = db.getUser(userId);

        // Delete message if token was posted publicly
        if (message.deletable && args.length > 0) {
            await message.delete().catch(() => {});
        }

        const tokenArg = args[0]?.trim();

        // 1. If no token provided in command -> Render Image 2 (Account Authorization)
        // Buttons: [ Link Token ] and [ How to Link? ] are handled globally in onInteraction.js
        if (!tokenArg) {
            const authCard = buildAccountAuthorization(client);
            try {
                return await message.reply({
                    components: [authCard.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {
                return await message.reply({
                    embeds: [authCard.fallbackEmbed],
                    components: authCard.actionRows
                });
            }
        }

        // 2. Direct token passed -> Validate with Discord API
        let targetSlot = user.activeSlot || 1;
        const emptySlot = Object.keys(user.slots).find(k => user.slots[k] === null);
        if (emptySlot) targetSlot = Number(emptySlot);

        let accountName = message.author.username;

        const validation = await discordApi.validateUserToken(tokenArg);
        if (!validation.valid) {
            return message.reply({
                content: `❌ Token validation failed: \`${validation.error}\`. Please double-check your Discord user token.`
            });
        }
        accountName = validation.user.globalName || validation.user.username;
        db.linkAccount(userId, targetSlot, {
            token: tokenArg,
            id: validation.user.id,
            username: validation.user.username,
            globalName: validation.user.globalName,
            avatar: validation.user.avatar,
            nitroType: validation.user.nitroType
        });

        // Render Image 3 (Account Linked Success)
        const successCard = buildAccountLinkedSuccess(client, accountName, targetSlot);
        try {
            await message.channel.send({
                components: [successCard.container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            await message.channel.send({
                embeds: [successCard.fallbackEmbed]
            });
        }
    }
};
