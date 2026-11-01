const { buildHomeView, buildCommandView, sendHelp, attachHelpCollector } = require('../../lib/functions/helpContainer.js');

/** @type {import('../../lib/types/index.ts').MessageCommand} */
module.exports = {
    alias: ['help', 'h'],
    desc: 'Interactive help menu with category browsing & command info',
    category: 'Utility',
    cooldown: '3s',
    usage: '.help [command]   •   /help [command]',
    detailedDesc: 'Explore all ORBYTE automation modules, view command overviews, inspection guides, syntax parameters, and live permission flags.',
    userPermissions: ['SendMessages'],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    requirements: 'None',
    executionFlow: [
        '1. Loads registered bot command modules and category catalogs',
        '2. Constructs interactive Container V2 layout with dynamic status metrics',
        '3. Enables live interactive dropdowns and navigation buttons'
    ],
    examples: [
        '.help',
        '.help quest',
        '.help questall',
        '/help'
    ],
    devOnly: false,

    async execute(client, message, args) {
        const query = args[0]?.toLowerCase();

        if (query) {
            const command = client.messageCommands.get(query) ||
                client.messageCommands.find(c => c.alias?.includes(query));

            if (!command) {
                return message.reply({
                    content: `❌ Could not find command \`${query}\`. Run \`.help\` to view all modules.`
                });
            }

            const cmdData = buildCommandView(client, command);
            const sent = await sendHelp(message, cmdData);
            if (sent) {
                attachHelpCollector(sent, client, message.author.id);
            }
            return;
        }

        const homeData = buildHomeView(client);
        const sent = await sendHelp(message, homeData);
        if (sent) {
            attachHelpCollector(sent, client, message.author.id);
        }
    }
};
