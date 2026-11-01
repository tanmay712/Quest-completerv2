const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['adminconfig', 'settings'],
    desc: 'Manage authorized quest access roles & bot permissions',
    category: 'Admin',
    cooldown: '5s',
    usage: '.adminconfig   •   /adminconfig',
    detailedDesc: 'View and configure server-wide quest automation policies, alert broadcast channels, authorized role bindings, and execution logs.',
    userPermissions: ['ManageGuild'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Manage Server permission',
    executionFlow: [
        '1. Loads server configuration and permission records',
        '2. Checks alert channels and role bindings health',
        '3. Renders complete server admin dashboard'
    ],
    examples: [
        '.adminconfig',
        '.settings',
        '/adminconfig'
    ],
    devOnly: false,

    async execute(client, message) {
        const guildId = message.guild.id;
        const guildConfig = db.getGuild(guildId);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const alertChannelText = guildConfig.alertChannelId ? `<#${guildConfig.alertChannelId}>` : '`Not Configured`';
        const roleText = guildConfig.authorizedRoleId ? `<@&${guildConfig.authorizedRoleId}>` : '`Administrators Only`';
        const alertRoleText = guildConfig.alertRoleId ? `<@&${guildConfig.alertRoleId}>` : '`None`';

        const content = [
            `# ℹ️ Server Quest Configuration`,
            `Guild: **${message.guild.name}** (\`${message.guild.id}\`)`,
            '',
            `⚙️ **Prefix:** \`${config.clientPrefix || '.'}\``,
            `🛡️ **Authorized Quest Role:** ${roleText}`,
            `📢 **Quest Alert Channel:** ${alertChannelText}`,
            `🔔 **Alert Ping Role:** ${alertRoleText}`,
            `🤖 **Auto-Quest System:** \`Active (24/7 Engine)\``,
            '',
            `Use \`.setup-alerts <#channel>\` and \`.setrole <@role>\` to modify settings.`
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
