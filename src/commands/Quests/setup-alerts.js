const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['setup-alerts', 'alerts'],
    desc: 'Auto-announce new quest drops to a channel',
    category: 'Quests',
    cooldown: '5s',
    usage: '.setup-alerts <#channel> [@role] / .setup-alerts disable   •   /setup-alerts [channel] [role] [disable]',
    detailedDesc: 'Configures a server channel where O R B Y T E will automatically broadcast new Discord quests within 5 minutes of release, featuring rewards, expiration timers, and quick-claim info.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Administrator or Manage Server permission',
    executionFlow: [
        '1. Links target announcement channel and optional alert ping role',
        '2. Quest watcher monitors official Discord quest catalog every 5 minutes',
        '3. Automatically sends richly formatted announcement card on new release'
    ],
    examples: [
        '.setup-alerts #quest-drops @QuestAlerts',
        '.setup-alerts disable',
        '/setup-alerts'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const guildId = message.guild.id;
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        if (args[0]?.toLowerCase() === 'disable') {
            db.updateGuild(guildId, g => {
                g.alertChannelId = null;
                g.alertRoleId = null;
            });
            return message.reply({ content: `🔕 Quest alert broadcasts have been disabled for **${message.guild.name}**.` });
        }

        const channel = message.mentions.channels.first() || message.channel;
        const role = message.mentions.roles.first();

        db.updateGuild(guildId, g => {
            g.alertChannelId = channel.id;
            if (role) g.alertRoleId = role.id;
        });

        const roleText = role ? `• **Ping Role:** <@&${role.id}>` : '• **Ping Role:** None';

        const content = [
            `# 📢 Quest Alerts Configured`,
            `Broadcast Channel: <#${channel.id}>`,
            `Server: **${message.guild.name}**`,
            roleText,
            '',
            `O R B Y T E will now automatically broadcast newly published Discord quests here within 5 minutes.`,
            '',
            `*To disable, use \`${config.clientPrefix || '.'}setup-alerts disable\`*`
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
            await message.reply({ content: `📢 Quest announcements configured to <#${channel.id}>!` });
        }
    }
};
