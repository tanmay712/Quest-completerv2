const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');
const discordApi = require('../../lib/services/discordApi.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['clearbadge', 'removebadge'],
    desc: 'Remove selected HypeSquad badge',
    category: 'Discord Badges',
    cooldown: '5s',
    usage: '.clearbadge   •   /clearbadge',
    detailedDesc: 'Leave HypeSquad and purge the badge from your user profile. Completely clears any active house membership on Discord.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link)',
    executionFlow: [
        '1. Dispatches departure payload to Discord HypeSquad API',
        '2. Removes house flag bit from profile metadata',
        '3. Confirms badge removal across Discord clients'
    ],
    examples: [
        '.clearbadge',
        '.removebadge',
        '/clearbadge'
    ],
    devOnly: false,

    async execute(client, message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        if (!activeAccount) {
            return message.reply({
                content: `❌ No linked account found for Slot ${user.activeSlot || 1}. Please run \`${config.clientPrefix || '.'}link <token>\` first.`
            });
        }

        if (!activeAccount.isDemo) {
            await discordApi.clearHypeSquad(activeAccount.token);
        }

        const content = [
            `# 🌸 Discord Badge Removed`,
            `HypeSquad membership was cleared for **Slot ${user.activeSlot} (\`${activeAccount.username}\`)**.`,
            `Your profile badge has been reset.`,
            '',
            `You can choose a house again anytime via \`${config.clientPrefix || '.'}hypesquad <bravery|brilliance|balance>\`.`
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
            await message.reply({ content: `🌸 HypeSquad badge successfully removed.` });
        }
    }
};
