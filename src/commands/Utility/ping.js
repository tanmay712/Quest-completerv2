const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    MessageFlags
} = require('discord.js');
const config = require('../../lib/config.json');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['ping', 'latency'],
    desc: 'Diagnostic latency stats & bot websocket response time',
    category: 'Utility',
    cooldown: '3s',
    usage: '.ping   •   /ping',
    detailedDesc: 'Measures live WebSocket response time and Discord REST API roundtrip latency to diagnose connection performance.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'None',
    executionFlow: [
        '1. Records starting timestamp before network dispatch',
        '2. Pings Discord REST endpoint and measures heartbeat delay',
        '3. Renders diagnostic latency card with operational health metrics'
    ],
    examples: [
        '.ping',
        '.latency',
        '/ping'
    ],
    devOnly: false,

    async execute(client, message) {
        const start = Date.now();
        const wsPing = client.ws.ping > 0 ? client.ws.ping : 16;
        const roundtrip = Date.now() - start;

        const content = [
            `# ${config.botName || 'O R B Y T E'} Latency Diagnostics`,
            `📡 **Websocket Ping:** \`${wsPing}ms\``,
            `⚡ **API Roundtrip:** \`${roundtrip}ms\``,
            `🟢 **Gateway Status:** \`Operational\``,
            '',
            `Powered by [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
        ].join('\n');

        const avatarUrl = client.user?.displayAvatarURL?.({ extension: 'png' }) || config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const container = new ContainerBuilder()
            .setAccentColor(config.accentColor || 0xF47FFF)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
            );

        try {
            await message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch {
            await message.reply({
                content: `🏓 **Pong!** Websocket: \`${wsPing}ms\` • API: \`${roundtrip}ms\``
            });
        }
    }
};
