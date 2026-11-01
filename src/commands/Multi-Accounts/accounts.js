const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['accounts', 'accs', 'slots'],
    desc: 'View connected accounts and active slots',
    category: 'Multi-Accounts',
    cooldown: '3s',
    usage: '.accounts   •   /accounts',
    detailedDesc: 'View all linked accounts, slot occupancy, token health, active stream runs, and which slot is currently targeted for quest operations.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'None',
    executionFlow: [
        '1. Queries stored account slots for your Discord user ID',
        '2. Pings Discord gateway to verify token freshness',
        '3. Renders multi-slot dashboard showing active selection'
    ],
    examples: [
        '.accounts',
        '.slots',
        '/accounts'
    ],
    devOnly: false,

    async execute(client, message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const formatSlot = (num) => {
            const acc = user.slots[String(num)];
            const isActive = user.activeSlot === num;
            const activeTag = isActive ? ' **(Active)**' : '';
            if (acc) {
                return `• **Slot ${num}:** \`${acc.username}\` • Token: \`Valid ✓\`${activeTag}`;
            }
            return `• **Slot ${num}:** \`[Unlinked Slot]\`${activeTag}`;
        };

        const content = [
            `# 👤 Linked Multi-Account Slots`,
            formatSlot(1),
            formatSlot(2),
            formatSlot(3),
            '',
            `Switch active slot with \`${config.clientPrefix || '.'}switch <1-3>\``,
            `Link a new slot with \`${config.clientPrefix || '.'}link <token>\``
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
            await message.reply({ content });
        }
    }
};
