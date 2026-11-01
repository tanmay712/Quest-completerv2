const { ApplicationCommandType, ApplicationCommandOptionType } = require('discord.js');
const { buildHomeView, buildCommandView, sendHelp, attachHelpCollector } = require('../lib/functions/helpContainer.js');

/** @type {import('../lib/types/index.ts').SlashCommand} */
module.exports = {
    name: 'help',
    description: 'Display the interactive ORBYTE Container V2 help menu.',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'command',
            description: 'Get information about a specific command',
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],
    botPermissions: ['SendMessages', 'EmbedLinks'],
    userPermissions: ['SendMessages'],
    devOnly: false,

    async execute(client, interaction) {
        const query = interaction.options?.getString('command')?.toLowerCase();

        if (query) {
            const command = client.messageCommands.get(query) ||
                client.messageCommands.find(c => c.alias?.includes(query));

            if (!command) {
                return interaction.reply({
                    content: `❌ Could not find command \`${query}\`. Run \`/help\` to view all modules.`,
                    flags: 'Ephemeral'
                });
            }

            const cmdData = buildCommandView(client, command);
            const sent = await sendHelp(interaction, cmdData);
            if (sent) {
                const messageObj = await interaction.fetchReply();
                attachHelpCollector(messageObj, client, interaction.user.id);
            }
            return;
        }

        const homeData = buildHomeView(client);
        const sent = await sendHelp(interaction, homeData);
        if (sent) {
            const messageObj = await interaction.fetchReply();
            attachHelpCollector(messageObj, client, interaction.user.id);
        }
    }
};
