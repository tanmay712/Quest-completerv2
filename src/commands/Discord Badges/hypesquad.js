const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');
const discordApi = require('../../lib/services/discordApi.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['hypesquad', 'badge', 'hs'],
    desc: 'Instant HypeSquad Bravery, Brilliance & Balance',
    category: 'Discord Badges',
    cooldown: '5s',
    usage: '.hypesquad <bravery|brilliance|balance>   •   /hypesquad [house]',
    detailedDesc: 'Instantly assign or change your Discord profile HypeSquad house badge without taking the official quiz. Updates immediately on Discord servers and your profile.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link)',
    executionFlow: [
        '1. Sends house selection request to Discord HypeSquad endpoint',
        '2. Applies house flag to your Discord profile',
        '3. Confirms badge application with house emblem and color'
    ],
    examples: [
        '.hypesquad bravery',
        '.hypesquad brilliance',
        '.hypesquad balance',
        '/hypesquad house:bravery'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        if (!activeAccount) {
            return message.reply({
                content: `❌ No linked account found for Slot ${user.activeSlot || 1}. Please run \`${config.clientPrefix || '.'}link <token>\` first.`
            });
        }

        const houseInput = args[0]?.toLowerCase() || 'bravery';
        const houseMap = {
            bravery: { id: 1, name: 'HypeSquad Bravery', emoji: '🟣' },
            brilliance: { id: 2, name: 'HypeSquad Brilliance', emoji: '🔴' },
            balance: { id: 3, name: 'HypeSquad Balance', emoji: '🟢' }
        };

        const targetHouse = houseMap[houseInput] || houseMap.bravery;

        // Call real API if not in demo mode
        if (!activeAccount.isDemo) {
            const apiRes = await discordApi.setHypeSquad(activeAccount.token, targetHouse.id);
            if (!apiRes.success) {
                return message.reply({
                    content: `⚠️ Discord API error: ${apiRes.error || 'Failed to update badge'}. Please re-verify your token.`
                });
            }
        }

        const content = [
            `# 🌸 Discord Badge Updated`,
            `${targetHouse.emoji} **HypeSquad House Assigned:** \`${targetHouse.name}\``,
            `Applied to: **Slot ${user.activeSlot} (\`${activeAccount.username}\`)**`,
            '',
            `Your Discord profile badge has been updated on the official Discord servers without taking the quiz!`,
            '',
            `*To remove, use \`${config.clientPrefix || '.'}clearbadge\`*`
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
            await message.reply({ content: `🌸 Badge set to **${targetHouse.name}**!` });
        }
    }
};
