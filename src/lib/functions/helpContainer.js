const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const config = require('../config.json');

const CATEGORIES = {
    home: {
        key: 'home',
        label: 'Home',
        emoji: '🏠',
        description: 'Overview and modules summary'
    },
    quests: {
        key: 'quests',
        folder: 'Quests',
        label: 'Quests',
        title: 'Quests Commands',
        count: 8,
        emoji: '🎮',
        summary: 'Complete, track, stats & auto-alerts for Discord quests'
    },
    'multi-accounts': {
        key: 'multi-accounts',
        folder: 'Multi-Accounts',
        label: 'Multi-Accounts',
        title: 'Multi-Accounts Commands',
        count: 6,
        emoji: '👤',
        summary: 'Link up to 3 Discord accounts & switch active slots'
    },
    'discord-badges': {
        key: 'discord-badges',
        folder: 'Discord Badges',
        label: 'Discord Badges',
        title: 'Discord Badges Commands',
        count: 2,
        emoji: '🌸',
        summary: 'Instant HypeSquad Bravery, Brilliance & Balance'
    },
    'rich-presence': {
        key: 'rich-presence',
        folder: 'Rich Presence',
        label: 'Rich Presence',
        title: 'Rich Presence Commands',
        count: 1,
        emoji: '💫',
        summary: '24/7 Custom RPC, streaming, listening, watching & VR status'
    },
    utility: {
        key: 'utility',
        folder: 'Utility',
        label: 'Utility',
        title: 'Utility Commands',
        count: 3,
        emoji: '🔧',
        summary: 'Diagnostic latency stats & bot documentation'
    },
    admin: {
        key: 'admin',
        folder: 'Admin',
        label: 'Admin',
        title: 'Admin Commands',
        count: 2,
        emoji: 'ℹ️',
        summary: 'Manage authorized quest access roles & bot permissions'
    }
};

function getBotAvatar(client) {
    if (client.user && typeof client.user.displayAvatarURL === 'function') {
        return client.user.displayAvatarURL({ extension: 'png', size: 512 });
    }
    return config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';
}

function getCategoryCommands(client, catKey) {
    const meta = CATEGORIES[catKey];
    if (!meta || !client.messageCommands) return [];
    const list = [];
    for (const cmd of client.messageCommands.values()) {
        const cat = (cmd.category || '').toLowerCase().replace(/[\s_]+/g, '-');
        if (cat === catKey || (meta.folder && cmd.category === meta.folder)) {
            list.push(cmd);
        }
    }
    return list;
}

/**
 * 1. Build Main Home Overview Container
 */
function buildHomeView(client) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);
    const prefix = config.clientPrefix || '.';
    const ping = client.ws?.ping && client.ws.ping > 0 ? client.ws.ping : 16;
    const servers = client.guilds?.cache?.size || 2;
    const totalCommands = client.messageCommands?.size || 22;

    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${config.botName || 'O R B Y T E'}\n${config.botSubtitle || 'Ultimate Discord Quest Automation'} • [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const contentText = [
        `\`🎱 Prefix: ${prefix}\` • \`Ping: ${ping}ms\` • \`Servers: ${servers}\` • \`Commands: ${totalCommands}\``,
        '',
        '### Command Modules',
        `🎮 **Quests** \`(8)\` — ${CATEGORIES.quests.summary}`,
        `👤 **Multi-Accounts** \`(6)\` — ${CATEGORIES['multi-accounts'].summary}`,
        `🌸 **Discord Badges** \`(2)\` — ${CATEGORIES['discord-badges'].summary}`,
        `💫 **Rich Presence** \`(1)\` — ${CATEGORIES['rich-presence'].summary}`,
        `🔧 **Utility** \`(3)\` — ${CATEGORIES.utility.summary}`,
        `ℹ️ **Admin** \`(2)\` — ${CATEGORIES.admin.summary}`,
        '',
        `Quick Start: \`${prefix}link\` -> \`${prefix}quest\` / \`${prefix}questall\` -> \`${prefix}autoquest\` | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_module_select')
            .setPlaceholder('Home')
            .addOptions([
                new StringSelectMenuOptionBuilder()
                    .setLabel('Home')
                    .setValue('home')
                    .setDescription('Overview and modules summary')
                    .setEmoji('🏠')
                    .setDefault(true),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Quests')
                    .setValue('quests')
                    .setDescription(CATEGORIES.quests.summary.slice(0, 95))
                    .setEmoji('🎮'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Multi-Accounts')
                    .setValue('multi-accounts')
                    .setDescription(CATEGORIES['multi-accounts'].summary.slice(0, 95))
                    .setEmoji('👤'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Discord Badges')
                    .setValue('discord-badges')
                    .setDescription(CATEGORIES['discord-badges'].summary.slice(0, 95))
                    .setEmoji('🌸'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Rich Presence')
                    .setValue('rich-presence')
                    .setDescription(CATEGORIES['rich-presence'].summary.slice(0, 95))
                    .setEmoji('💫'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Utility')
                    .setValue('utility')
                    .setDescription(CATEGORIES.utility.summary.slice(0, 95))
                    .setEmoji('🔧'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Admin')
                    .setValue('admin')
                    .setDescription(CATEGORIES.admin.summary.slice(0, 95))
                    .setEmoji('ℹ️')
            ])
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs'),
        new ButtonBuilder()
            .setCustomId('help_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(headerSection)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText))
        .addActionRowComponents(selectMenu, buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setAuthor({
            name: `${config.botName || 'O R B Y T E'} — ${config.botSubtitle || 'Ultimate Discord Quest Automation'}`,
            iconURL: avatarUrl,
            url: config.supportServer || 'https://discord.gg/infernodevs'
        })
        .setThumbnail(avatarUrl)
        .setDescription(contentText);

    return { container, fallbackEmbed, actionRows: [selectMenu, buttonRow] };
}

/**
 * 2. Build Category View (Matching Image 1)
 */
function buildCategoryView(client, catKey) {
    const meta = CATEGORIES[catKey] || CATEGORIES.quests;
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);
    const prefix = config.clientPrefix || '.';

    const commands = getCategoryCommands(client, catKey);

    // Header matching Image 1: "Quests Commands", "8 command(s) available • Select any command below for in-depth details"
    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${meta.title || `${meta.label} Commands`}\n${commands.length || meta.count} command(s) available • Select any command below for in-depth details`
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    // Command list matching Image 1 format: "• `.quest` — Pick and complete an individual active quest"
    const listLines = commands.map(cmd => {
        const primary = cmd.alias[0];
        return `• \`${prefix}${primary}\` — ${cmd.desc || 'No description provided'}`;
    });

    const overviewText = [
        '### Commands Overview',
        '',
        listLines.join('\n'),
        '',
        `Select any command from the dropdown menu below for syntax, aliases & examples. | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    // Dropdown to pick a command for detailed view (Matching Image 1: "Select a command for full details & examples...")
    const commandOptions = commands.map(cmd => {
        const primary = cmd.alias[0];
        return new StringSelectMenuOptionBuilder()
            .setLabel(`${prefix}${primary}`)
            .setValue(`cmd_${primary}`)
            .setDescription((cmd.desc || '').slice(0, 95));
    });

    const commandSelectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_command_select')
            .setPlaceholder('Select a command for full details & examples...')
            .addOptions(commandOptions.length > 0 ? commandOptions : [
                new StringSelectMenuOptionBuilder().setLabel('No commands').setValue('none')
            ])
    );

    // Buttons: [ Home ] [ Inferno Devs ↗ ] [ Close ]
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('help_home')
            .setLabel('Home')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs'),
        new ButtonBuilder()
            .setCustomId('help_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(headerSection)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(overviewText))
        .addActionRowComponents(commandSelectRow, buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setAuthor({
            name: `${meta.title || `${meta.label} Commands`}`,
            iconURL: avatarUrl
        })
        .setThumbnail(avatarUrl)
        .setDescription(overviewText);

    return { container, fallbackEmbed, actionRows: [commandSelectRow, buttonRow] };
}

/**
 * 3. Build Command Details View (Matching Images 2, 3, 4, 5)
 */
function buildCommandView(client, command) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);
    const prefix = config.clientPrefix || '.';

    const primary = command.alias[0];
    const category = command.category || 'Utility';
    const cooldown = command.cooldown || '5s';
    const description = (command.detailedDesc || command.desc || '').replace(/\{p\}/g, prefix);
    const usage = (command.usage || `${prefix}${primary}`).replace(/\{p\}/g, prefix);

    const aliasList = command.alias.length > 1
        ? command.alias.slice(1).map(a => `\`${prefix}${a}\``).join(', ')
        : '`None`';

    const userPerms = (command.userPermissions && command.userPermissions.length)
        ? command.userPermissions.map(p => `\`${p}\``).join(', ')
        : '`Send Messages`';

    const botPerms = (command.botPermissions && command.botPermissions.length)
        ? command.botPermissions.map(p => `\`${p}\``).join(', ')
        : '`Send Messages`, `Embed Links`';

    const requirements = (command.requirements || 'None').replace(/\{p\}/g, prefix);

    // Execution flow array into formatted numbered code block
    const flowText = (command.executionFlow && command.executionFlow.length > 0)
        ? command.executionFlow.join('\n')
        : '1. Validates command parameters and user authorization\n2. Executes routine through Discord gateway\n3. Dispatches formatted status receipt';

    // Examples array into bulleted backticks
    const examplesList = (command.examples && command.examples.length > 0)
        ? command.examples.map(ex => `• \`${ex.replace(/\{p\}/g, prefix)}\``).join('\n')
        : `• \`${prefix}${primary}\``;

    // Header Section: "Command / .quest", "Category: Quests | Cooldown: 5s"
    const headerSection = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# Command / \`${prefix}${primary}\`\nCategory: ${category} | Cooldown: ${cooldown}`
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    // Body content matching Images 2-5 structure
    const bodyContent = [
        `>>> **Description:** ${description}`,
        `**Usage:** \`${usage}\``,
        `**Aliases:** ${aliasList}`,
        `**Permissions:** User: ${userPerms} • Bot: ${botPerms}`,
        `**Requirements:** ${requirements}`,
        '',
        '**Execution Flow:**',
        '```',
        flowText,
        '```',
        '**Examples:**',
        examplesList,
        '',
        `Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const catKey = category.toLowerCase().replace(/[\s_]+/g, '-');

    // Buttons: [ Back ] [ Home ] [ Inferno Devs ↗ ] [ Close ]
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`help_back_${catKey}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('help_home')
            .setLabel('Home')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs'),
        new ButtonBuilder()
            .setCustomId('help_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(headerSection)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyContent))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setAuthor({
            name: `Command / ${prefix}${primary} — Category: ${category}`,
            iconURL: avatarUrl
        })
        .setThumbnail(avatarUrl)
        .setDescription(bodyContent);

    return { container, fallbackEmbed, actionRows: [buttonRow] };
}

/**
 * Universal dispatcher
 */
function buildHelpMenu(client, target = 'home') {
    if (target === 'home') {
        return buildHomeView(client);
    }
    if (CATEGORIES[target]) {
        return buildCategoryView(client, target);
    }
    // Specific command
    const cmd = client.messageCommands.get(target) ||
        client.messageCommands.find(c => c.alias?.includes(target));
    if (cmd) {
        return buildCommandView(client, cmd);
    }
    return buildHomeView(client);
}

/**
 * Safe sender with Container V2 primary and Embed fallback
 */
async function sendHelp(target, helpData) {
    try {
        return await target.reply({
            components: [helpData.container],
            flags: MessageFlags.IsComponentsV2
        });
    } catch (err) {
        return await target.reply({
            embeds: [helpData.fallbackEmbed],
            components: helpData.actionRows
        });
    }
}

/**
 * Attaches collector for interactive browsing
 */
function attachHelpCollector(sentMessage, client, authorId) {
    const collector = sentMessage.createMessageComponentCollector({
        time: 300_000 // 5 minutes
    });

    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== authorId) {
            return interaction.reply({
                content: `❌ This menu belongs to <@${authorId}>. Run \`${config.clientPrefix || '.'}help\` to open your own menu!`,
                flags: 'Ephemeral'
            }).catch(() => {});
        }

        // Close button
        if (interaction.customId === 'help_close') {
            collector.stop('closed');
            try {
                await interaction.message.delete();
            } catch (e) {}
            return;
        }

        // Home button
        if (interaction.customId === 'help_home') {
            const homeData = buildHomeView(client);
            try {
                await interaction.update({
                    components: [homeData.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {
                await interaction.update({
                    embeds: [homeData.fallbackEmbed],
                    components: homeData.actionRows
                });
            }
            return;
        }

        // Back button to category
        if (interaction.customId.startsWith('help_back_')) {
            const catKey = interaction.customId.replace('help_back_', '');
            const catData = buildCategoryView(client, catKey);
            try {
                await interaction.update({
                    components: [catData.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {
                await interaction.update({
                    embeds: [catData.fallbackEmbed],
                    components: catData.actionRows
                });
            }
            return;
        }

        // Module selection from Home dropdown
        if (interaction.customId === 'help_module_select') {
            const val = interaction.values[0];
            const data = (val === 'home') ? buildHomeView(client) : buildCategoryView(client, val);
            try {
                await interaction.update({
                    components: [data.container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch {
                await interaction.update({
                    embeds: [data.fallbackEmbed],
                    components: data.actionRows
                });
            }
            return;
        }

        // Command selection from Category dropdown
        if (interaction.customId === 'help_command_select') {
            const val = interaction.values[0].replace('cmd_', '');
            const cmd = client.messageCommands.get(val) ||
                client.messageCommands.find(c => c.alias?.includes(val));

            if (cmd) {
                const cmdData = buildCommandView(client, cmd);
                try {
                    await interaction.update({
                        components: [cmdData.container],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch {
                    await interaction.update({
                        embeds: [cmdData.fallbackEmbed],
                        components: cmdData.actionRows
                    });
                }
            }
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'closed') return;
        try {
            const homeData = buildHomeView(client);
            homeData.actionRows.forEach(row => {
                row.components.forEach(comp => {
                    if (comp.data.style !== ButtonStyle.Link) comp.setDisabled(true);
                });
            });
            await sentMessage.edit({
                components: [homeData.container],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});
        } catch (e) {}
    });

    return collector;
}

module.exports = {
    CATEGORIES,
    buildHomeView,
    buildCategoryView,
    buildCommandView,
    buildHelpMenu,
    sendHelp,
    attachHelpCollector
};
