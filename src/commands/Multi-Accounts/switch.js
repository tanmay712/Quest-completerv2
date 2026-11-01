const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['switch', 'setactive'],
    desc: 'Switch active account slot for quest operations',
    category: 'Multi-Accounts',
    cooldown: '3s',
    usage: '.switch <slot_number>   •   /switch [slot]',
    detailedDesc: 'Switch active account slot for all incoming quest operations, badge setters, and rich presence broads. Keeps multiple accounts organized seamlessly.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Target slot must be linked and verified',
    executionFlow: [
        '1. Checks if the requested account slot has a valid token',
        '2. Sets the active slot pointer in your user session',
        '3. Automatically loads target account quest catalog'
    ],
    examples: [
        '.switch 1',
        '.switch 2',
        '/switch slot:2'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const slotNum = parseInt(args[0], 10);
        if (!slotNum || slotNum < 1 || slotNum > 3) {
            return message.reply({ content: `❌ Please provide a valid slot number between 1 and 3 (e.g. \`.switch 2\`).` });
        }

        const targetAccount = user.slots[String(slotNum)];
        if (!targetAccount) {
            return message.reply({
                content: `⚠️ **Slot ${slotNum}** is currently empty! Link an account first using \`.link <token>\`.`
            });
        }

        db.switchActiveSlot(userId, slotNum);

        const content = [
            `# 🔄 Account Slot Switched`,
            `Active slot is now set to: **Slot ${slotNum}** (\`${targetAccount.username}\`)`,
            `All upcoming quest actions, badges, and RPC updates will now target this account.`,
            '',
            `Use \`${config.clientPrefix || '.'}accounts\` to review all linked profiles.`
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
            await message.reply({ content: `🔄 Active slot set to **Slot ${slotNum}** (\`${targetAccount.username}\`).` });
        }
    }
};
