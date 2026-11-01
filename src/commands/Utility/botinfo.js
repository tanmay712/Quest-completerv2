const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const config = require('../../lib/config.json');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['botinfo', 'info', 'stats'],
    desc: 'Diagnostic latency stats & bot documentation',
    category: 'Utility',
    cooldown: '3s',
    usage: '.botinfo   •   /botinfo',
    detailedDesc: 'Comprehensive specifications, system statistics, cluster memory allocation, uptime, and developer credits for the bot.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'None',
    executionFlow: [
        '1. Gathers Node.js v8 heap usage and process metrics',
        '2. Queries active guild shards and command collections',
        '3. Renders system info panel'
    ],
    examples: [
        '.botinfo',
        '.info',
        '/botinfo'
    ],
    devOnly: false,

    async execute(client, message) {
        const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const uptime = Math.floor(process.uptime() / 60);
        const servers = client.guilds?.cache?.size || 2;
        const totalCmds = client.messageCommands?.size || 22;
        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const content = [
            `# ${config.botName || 'O R B Y T E'} — System Info`,
            `**Framework:** Discord.js \`v14.25.1\` • Node.js \`${process.versions.node}\``,
            `**Uptime:** \`${uptime} minutes\` • **Memory:** \`${memoryMB} MB\``,
            `**Guilds:** \`${servers}\` • **Commands Registered:** \`${totalCmds}\``,
            `**Architecture:** \`${process.platform}-${process.arch}\``,
            '',
            `Built with ❤️ by [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
        ].join('\n');

        const container = new ContainerBuilder()
            .setAccentColor(config.accentColor || 0xF47FFF)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(config.developerName || 'Inferno Devs')
                        .setStyle(ButtonStyle.Link)
                        .setURL(config.supportServer || 'https://discord.gg/infernodevs')
                )
            );

        try {
            await message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            await message.reply({ content });
        }
    }
};
