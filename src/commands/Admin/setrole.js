const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
const config = require('../../lib/config.json');
const db = require('../../lib/services/database.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['setrole', 'questrole'],
    desc: 'Manage authorized quest access roles & bot permissions',
    category: 'Admin',
    cooldown: '5s',
    usage: '.setrole <@role>   •   /setrole [role]',
    detailedDesc: 'Assign an authorized server role permitted to trigger bot quest routines, batch operations, and quest alert channels without needing Administrator permissions.',
    userPermissions: ['Administrator'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'Administrator permission on server',
    executionFlow: [
        '1. Resolves mention or ID of target server role',
        '2. Saves authorized role ID in guild database configuration',
        '3. Authorizes all members holding that role'
    ],
    examples: [
        '.setrole @QuestAccess',
        '.setrole 123456789012345678',
        '/setrole role:@QuestAccess'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const role = message.mentions.roles.first() || (args[0] ? message.guild.roles.cache.get(args[0]) : null);
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        if (!role) {
            return message.reply({ content: `❌ Please mention a valid role or provide a valid role ID (e.g. \`.setrole @QuestRole\`).` });
        }

        db.updateGuild(message.guild.id, g => {
            g.authorizedRoleId = role.id;
        });

        const content = [
            `# ℹ️ Quest Access Role Configured`,
            `🛡️ **Authorized Role:** <@&${role.id}> (\`${role.name}\`)`,
            `Server: **${message.guild.name}**`,
            '',
            `Members with this role are now permitted to invoke quest automation routines and manage server quest settings.`,
            '',
            `Configuration saved to database.`
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
            await message.reply({ content: `🛡️ Quest access role configured to **${role.name}**.` });
        }
    }
};
