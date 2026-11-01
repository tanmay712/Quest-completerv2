const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['unlink', 'removeaccount'],
    desc: 'Unlink a connected Discord account slot',
    category: 'Multi-Accounts',
    cooldown: '5s',
    usage: '.unlink <slot_1|slot_2|slot_3>   •   /unlink [slot]',
    detailedDesc: 'Safely disconnect and purge a stored account slot. Invalidates cached Discord session tokens, removes from the quest automation runner, and frees the slot for another account.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'At least 1 linked account slot',
    executionFlow: [
        '1. Confirms target account slot number (1, 2, or 3)',
        '2. Terminates any active stream emulation workers for that slot',
        '3. Permanently purges encrypted token and cache from database',
        '4. Re-assigns default active slot to remaining accounts'
    ],
    examples: [
        '.unlink 2',
        '.unlink slot_3',
        '/unlink slot:2'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const rawArg = args[0] || String(user.activeSlot || 1);
        const slotNum = parseInt(rawArg.replace(/\D/g, ''), 10) || 1;

        const targetAccount = user.slots[String(slotNum)];
        if (!targetAccount) {
            return message.reply({ content: `⚠️ **Slot ${slotNum}** is already empty.` });
        }

        const usernameRemoved = targetAccount.username;
        db.unlinkAccount(userId, slotNum);

        const content = [
            `# 👤 Account Unlinked`,
            `🗑️ **Target Slot:** \`Slot ${slotNum}\` (\`${usernameRemoved}\`)`,
            `Session invalidated and tokens purged from secure storage.`,
            '',
            `You can re-link a new account anytime with \`${config.clientPrefix || '.'}link\`.`
        ].join('\n');

        const container = new ContainerBuilder()
            .setAccentColor(config.accentColor || 0xF47FFF)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
            );

        try {
            await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch {
            await message.reply({ content: `🗑️ Slot ${slotNum} (\`${usernameRemoved}\`) unlinked successfully.` });
        }
    }
};
