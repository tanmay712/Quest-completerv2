const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['autoquest', 'aq', 'auto'],
    desc: 'Toggle 24/7 background quest auto-completer',
    category: 'Quests',
    cooldown: '5s',
    usage: '.autoquest   •   /autoquest',
    detailedDesc: 'Enables or disables automatic quest solving. When enabled, O R B Y T E continuously checks for new Discord quest drops every 5 minutes and completes them without requiring manual intervention.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link)',
    executionFlow: [
        '1. Registers your user ID in the automated background watcher',
        '2. Polls Discord quest catalog every 5 minutes for new releases',
        '3. Instantly starts solving any newly released or uncompleted quest',
        '4. Sends you a DM notification once the quest is completed so you can claim your reward'
    ],
    examples: [
        '.autoquest',
        '/autoquest'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        if (!activeAccount) {
            return message.reply({
                content: `⚠️ Please link your Discord account first via \`${config.clientPrefix || '.'}link <token>\` before enabling auto-quest.`
            });
        }

        let newStatus = !user.autoQuest;
        const arg = args[0]?.toLowerCase();
        if (arg === 'on' || arg === 'enable') newStatus = true;
        if (arg === 'off' || arg === 'disable') newStatus = false;

        db.updateUser(userId, u => {
            u.autoQuest = newStatus;
        });

        const statusLabel = newStatus ? '🟢 ENABLED' : '🔴 DISABLED';

        const content = [
            `# ⚙️ Automatic Quest Solving`,
            `Status: **${statusLabel}**`,
            `Account: **Slot ${user.activeSlot} (\`${activeAccount.username}\`)**`,
            '',
            newStatus
                ? `O R B Y T E is now continuously monitoring and solving Discord quest drops in the background.`
                : `Automatic quest solving has been paused. Quests will only be solved when triggered manually.`,
            '',
            `*Run \`${config.clientPrefix || '.'}autoquest\` to toggle anytime.*`
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
            await message.reply({ content: `⚙️ Autoquest is now **${statusLabel}**.` });
        }
    }
};
