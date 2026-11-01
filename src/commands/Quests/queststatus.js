const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');
const questEngine = require('../../lib/services/questEngine.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['queststatus', 'qs', 'status'],
    desc: 'Check live automation progress, active runs & quest health',
    category: 'Quests',
    cooldown: '3s',
    usage: '.queststatus   •   /queststatus',
    detailedDesc: 'Displays a real-time status dashboard for your active account. Shows currently running quest progress bars, remaining time, available backlog, auto-quest status, and rewards ready to claim.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Linked user token (.link)',
    executionFlow: [
        '1. Checks active automation runs and real-time completion progress',
        '2. Queries active account quest backlog and completion statistics',
        '3. Displays interactive status dashboard with one-click refresh'
    ],
    examples: [
        '.queststatus',
        '.qs',
        '/queststatus'
    ],
    devOnly: false,

    async execute(client, message) {
        const userId = message.author.id;
        const user = db.getUser(userId);
        const activeAccount = db.getActiveAccount(userId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const usernameDisplay = activeAccount?.username || message.author.username;
        const slotDisplay = user.activeSlot || 1;

        const status = questEngine.getQuestStatus(userId);

        let content = '';

        if (status.hasActive) {
            const q = status.quest;
            content = [
                `# 📊 Quest Automation Status Dashboard`,
                `User: **${usernameDisplay}** • Slot ${slotDisplay} *(Active)*`,
                '',
                `🎮 **Active Quest:** \`${q.title}\``,
                `⏳ **Progress:** \`${status.progressBar} ${status.percent}% (${status.elapsedMinutes}m / ${status.totalMinutes}m)\``,
                `⏱️ **Estimated Completion:** \`${status.remainingMinutes} minutes remaining\``,
                `🟢 **Health:** Stream heartbeat valid • Rate limit normal`,
                `🎁 **Pending Claims:** \`${user.completedQuests.filter(c => !c.claimed).length} reward(s) ready to claim\``,
                '',
                `Powered by [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
            ].join('\n');
        } else if (status.justCompleted) {
            content = [
                `# 🎉 Quest Completed!`,
                `User: **${usernameDisplay}** • Slot ${slotDisplay}`,
                '',
                `✅ **Quest Solved:** \`${status.justCompleted.title}\``,
                `🎁 **Reward:** \`${status.justCompleted.reward}\``,
                `✨ **Earned:** \`+50 Orbs\` (Total: \`${user.stats.orbs} Orbs\`)`,
                '',
                `Claim your reward directly in Discord or run \`${config.clientPrefix || '.'}quest\` to start the next one!`
            ].join('\n');
        } else {
            const pendingRewards = user.completedQuests.filter(c => !c.claimed).length;
            content = [
                `# 📊 Quest Automation Status Dashboard`,
                `User: **${usernameDisplay}** • Slot ${slotDisplay} *(Idle)*`,
                '',
                `⚪ **Status:** No quest currently in progress.`,
                `🏆 **Lifetime Quests Solved:** \`${user.stats.questsCompleted}\``,
                `🔮 **Current Orbs:** \`${user.stats.orbs} Orbs\``,
                `🎁 **Pending Claims:** \`${pendingRewards} ready to claim\``,
                '',
                `💡 *Run \`${config.clientPrefix || '.'}quest\` or \`${config.clientPrefix || '.'}questall\` to begin automated completion!*`
            ].join('\n');
        }

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
