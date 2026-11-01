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
const questEngine = require('../services/questEngine.js');

function getBotAvatar(client) {
    if (client?.user && typeof client.user.displayAvatarURL === 'function') {
        return client.user.displayAvatarURL({ extension: 'png', size: 512 });
    }
    return config.botLogo || 'https://cdn.discordapp.com/embed/avatars/0.png';
}

/**
 * Image 1: Account Not Linked UI
 */
function buildAccountNotLinked(client) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);

    const header = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ⚠️ Account Not Linked\nConnect your Discord user token to unlock this command`
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const bodyText = [
        `> ❌ **You do not have a Discord account token linked to ${config.botName || 'O R B Y T E'}.**`,
        '',
        `• Use \`.link\` to connect your Discord user token.`,
        `• Once linked, your token is encrypted with AES-256 and stored securely so you can run quests, automate drops, claim badges, and customize your profile.`,
        '',
        `Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs')
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle('⚠️ Account Not Linked')
        .setDescription(bodyText)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed, actionRows: [buttonRow] };
}

/**
 * Image 2: Account Authorization UI (.link command)
 */
function buildAccountAuthorization(client) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);

    const header = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# Account Authorization\nConnect your Discord user token to unlock quest automation | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
            )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const bodyText = [
        `• **Why is this required?**`,
        `> To simulate playtime, stream heartbeats, and complete quests, ${config.botName || 'O R B Y T E'} connects directly to Discord's quest system.`,
        '',
        `• **Security & Privacy**`,
        `> Your token is encrypted with AES-256 and stored locally. It is never logged, exposed, or transmitted to any third party.`,
        '',
        `Click **Link Token** to enter your token, or click **How to Link?** for device instructions.`
    ].join('\n');

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_open_link_modal')
            .setLabel('Link Token')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('btn_how_to_link')
            .setLabel('How to Link?')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs')
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle('Account Authorization')
        .setDescription(bodyText)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed, actionRows: [buttonRow] };
}

/**
 * Image 3: Account Linked Success UI
 */
function buildAccountLinkedSuccess(client, accountName, slotNumber = 1) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);

    const content = [
        `# ✅ Account Linked!`,
        `Linked "${accountName}" to Slot #${slotNumber} / 3.`,
        '',
        `• Active Account: **${accountName}**`,
        `• Use \`.accounts\` to view all slots or \`.switch\` to change active slot.`,
        `• You can now use \`/quest\` and \`/questall\` on your active account.`
    ].join('\n');

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

    const fallbackEmbed = new EmbedBuilder()
        .setColor(0x34C759)
        .setTitle('✅ Account Linked!')
        .setDescription(content)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed };
}

/**
 * Image 4: Quest Selection List UI
 */
function buildQuestSelectionList(client, user, questList = null) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);
    let catalog = (Array.isArray(questList) && questList.length > 0)
        ? questList
        : questEngine.getUserCatalog(user.userId || user.id);
    const prefix = config.clientPrefix || '.';

    // Prioritize active, unexpired quests
    const activeQuests = catalog.filter(q => !q.isExpired && q.expiresText !== 'expired');
    if (activeQuests.length > 0) {
        catalog = activeQuests;
    }

    const completedIds = (user.completedQuests || []).map(q => String(q.id));

    // Display at most 12 quests in text display to strictly prevent exceeding the 4000 char Discord limit
    const displayCatalog = catalog.slice(0, 12);

    const questLines = displayCatalog.map((q, idx) => {
        const isDone = Boolean(q.completed);
        const doneBadge = isDone ? ' *(Completed)*' : '';
        return `\`#${idx + 1}\` • **${q.title}**${doneBadge}\n> *${q.publisher || q.title}* • Expires ${q.expiresText || 'soon'}`;
    });

    const bodyText = [
        questLines.join('\n\n'),
        '',
        `*Select a quest from the dropdown below or run \`${prefix}quest <name / #number>\`.*`
    ].join('\n');

    const options = catalog.slice(0, 25).map((q, idx) => {
        const label = `#${idx + 1} - ${q.title.slice(0, 70)}`;
        const rewardClean = q.rewardText ? q.rewardText.replace(/[*_`✦]/g, '').trim().slice(0, 50) : '700 Orbs';
        return new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(`quest_pick_${q.id}`)
            .setDescription(`Reward: ${rewardClean}`);
    });

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_quest_to_solve')
            .setPlaceholder('Pick one or more quests to complete...')
            .addOptions(options)
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addActionRowComponents(selectRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setDescription(bodyText);

    return { container, fallbackEmbed, actionRows: [selectRow] };
}

/**
 * Image 5: Solving Quest Live UI
 */
function buildSolvingQuestCard(client, quest, percent = 0, statusMessage = null) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);

    const totalBars = 12;
    const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));
    const filled = Math.min(totalBars, Math.max(0, Math.round((clampedPercent / 100) * totalBars)));
    const empty = totalBars - filled;
    const progressBar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;

    const isCompleted = clampedPercent >= 100;
    const statusTitle = isCompleted ? '# ✅ Quest Completed!' : '# ◌ ◌ ◌ Solving Quest...';
    const progressLabel = isCompleted
        ? '100% — Complete! Reward Ready'
        : (statusMessage || `${clampedPercent}% — Working on it...`);

    const tasksText = (quest.taskDetails && quest.taskDetails.length > 0)
        ? quest.taskDetails.join('\n')
        : '• Play on Desktop • **15 min**\n• PLAY_ON_XBOX\n• PLAY_ON_PLAYSTATION';

    const contentText = [
        `### ${quest.title}`,
        `*${quest.title}* • ${quest.publisher || 'Electronic Arts'}`,
        '',
        '**Task Details**',
        tasksText,
        '',
        '**Expiration**',
        quest.expiresText || 'in 2 days *(2d left)*',
        '',
        '**Progress**',
        `\`[${progressBar}]\` **${progressLabel}**`,
        '',
        '**🎁 Reward**',
        quest.rewardText || '**700 Orbs ✦** *(700 Orbs)*',
        '',
        isCompleted
            ? `Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
            : `O R B Y T Ξ • Please wait while quest is running... | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const header = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(statusTitle))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const buttonRow = new ActionRowBuilder();
    if (!isCompleted) {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId('btn_cancel_quest')
                .setLabel('Cancel Quest')
                .setStyle(ButtonStyle.Danger)
        );
    }
    buttonRow.addComponents(
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs')
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(isCompleted ? 0x34C759 : accentColor)
        .setTitle(statusTitle.replace('# ', ''))
        .setDescription(contentText)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed, actionRows: [buttonRow] };
}

/**
 * Image 1 from latest upload: Quest Completed Final Card
 */
function buildQuestCompletedCard(client, quest) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);

    const header = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# ✅ Quest Completed!'))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const contentText = [
        `### ${quest.title}`,
        `*${quest.title}* • ${quest.publisher || 'Electronic Arts'}`,
        '',
        '> Your quest has been completed successfully!',
        '',
        '**🎁 Reward**',
        `${quest.rewardText || '**700 Orbs ✦** *(700 Orbs)*'}`,
        '',
        '**🎁 Note:** Please claim your rewards in the Discord app.',
        `Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs')
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(contentText))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(0x34C759)
        .setTitle('✅ Quest Completed!')
        .setDescription(contentText)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed, actionRows: [buttonRow] };
}

/**
 * Solving All Quests Live Parallel Card (Matching .questall UI)
 */
function buildSolvingAllQuestsCard(client, user, activeAccount, questStates, isAllDone = false) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);
    const accountName = activeAccount?.globalName || activeAccount?.username || user.userId || 'User';
    const slotNumber = user.activeSlot || 1;

    const totalCount = questStates.length;
    const completedCount = questStates.filter(q => q.isCompleted || q.percent >= 100).length;
    const allFinished = isAllDone || (totalCount > 0 && completedCount === totalCount);

    const title = allFinished ? '# ✅ All Quests Completed!' : '# ◌ ◌ ◌ Solving All Quests';
    const subtitle = allFinished
        ? `Successfully solved ${completedCount} quest(s) on **${accountName}** (Slot #${slotNumber})!`
        : `Completing ${totalCount} active quests in parallel on **${accountName}** (Slot #${slotNumber})...`;

    const header = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${title}\n${subtitle}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    // Cap items to top 18 if list is very large to strictly avoid Discord 4000 char constraint
    const displayItems = questStates.slice(0, 18);
    const remainingCount = totalCount - displayItems.length;

    const questLines = displayItems.map(q => {
        const isDone = q.isCompleted || q.percent >= 100;
        const pub = q.publisher || q.title || 'Discord Partner';
        if (isDone) {
            return `✅ **${q.title}**\n> *${pub}* • **Completed!**`;
        }
        const totalBars = 10;
        const clamped = Math.min(100, Math.max(0, Math.round(q.percent || 0)));
        const filled = Math.min(totalBars, Math.max(0, Math.round((clamped / 100) * totalBars)));
        const empty = totalBars - filled;
        const bar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
        return `◌ **${q.title}**\n> *${pub}* • \`[${bar}]\` **${clamped}%**`;
    });

    if (remainingCount > 0) {
        questLines.push(`*...and ${remainingCount} more active quest(s) enqueued in parallel.*`);
    }

    const noteText = [
        questLines.join('\n\n'),
        '',
        '💝 **Note:** Quests complete! Please claim your rewards in the Discord app.',
        `Active Account: **${accountName}** *(Slot #${slotNumber})* • Switch anytime with \`${config.clientPrefix || '.'}switch\` | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const buttonRow = new ActionRowBuilder();
    if (!allFinished) {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId('btn_cancel_questall')
                .setLabel('Cancel Quest')
                .setStyle(ButtonStyle.Danger)
        );
    }
    buttonRow.addComponents(
        new ButtonBuilder()
            .setLabel(config.developerName || 'Inferno Devs')
            .setStyle(ButtonStyle.Link)
            .setURL(config.supportServer || 'https://discord.gg/infernodevs')
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(noteText))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(allFinished ? 0x34C759 : accentColor)
        .setTitle(title.replace('# ', ''))
        .setDescription(`${subtitle}\n\n${noteText}`)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed, actionRows: [buttonRow] };
}

/**
 * Image: Your Discord Quests Pagination UI (Matching .questlist UI)
 */
function buildQuestListCard(client, allQuests, page = 1, pageSize = 4) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);

    const totalQuests = allQuests.length;
    const completedCount = allQuests.filter(q => q.completed).length;
    const totalPages = Math.max(1, Math.ceil(totalQuests / pageSize));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = allQuests.slice(startIndex, startIndex + pageSize);

    const title = '# 🎮 Your Discord Quests';
    const subtitle = `Page ${currentPage} of ${totalPages} • Total: ${totalQuests} quests (${completedCount} completed)`;

    const header = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${title}\n${subtitle}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const questEntries = pageItems.map((q, idx) => {
        const itemNumber = startIndex + idx + 1;
        const isDone = Boolean(q.completed);
        const statusBadge = isDone ? '✅ **Completed**' : '◌ **Available**';
        const pub = q.publisher || q.title || 'Discord Partner';
        const expiresClean = (q.expiresText || 'soon').replace(/[*()]/g, '').trim();
        const rewardText = q.rewardText
            ? q.rewardText.replace(/[*_`✦]/g, '').trim()
            : '700 Orbs (700 Orbs)';

        return [
            `\`#${itemNumber}\` • ${statusBadge} • **${q.title}**`,
            `> *${pub}* • Expires \`${expiresClean}\``,
            `> 🎁 ${rewardText}`
        ].join('\n');
    });

    const bodyText = [
        questEntries.join('\n\n'),
        '',
        `> Use \`${config.clientPrefix || '.'}quest <#number / name>\` to complete a specific quest.`,
        `Example: \`${config.clientPrefix || '.'}quest 1\` or \`${config.clientPrefix || '.'}quest genshin\` | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_questlist_first')
            .setLabel('First')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId('btn_questlist_back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId('btn_questlist_next')
            .setLabel('Next')
            .setStyle(currentPage >= totalPages ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages),
        new ButtonBuilder()
            .setCustomId('btn_questlist_last')
            .setLabel('Last')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages)
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle('🎮 Your Discord Quests')
        .setDescription(`${subtitle}\n\n${bodyText}`)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed, actionRows: [buttonRow], currentPage, totalPages };
}

/**
 * Image: Quest Profile UI (Matching .profile UI)
 */
function buildQuestProfileCard(client, user, activeAccount, discordAuthor) {
    const accentColor = config.accentColor || 0xF47FFF;
    const accountName = activeAccount?.globalName || activeAccount?.username || discordAuthor.globalName || discordAuthor.username;
    const accountHandle = activeAccount?.username || discordAuthor.username;
    const slotNumber = user.activeSlot || 1;

    let avatarUrl = discordAuthor.displayAvatarURL?.({ extension: 'png', size: 512 }) || config.botLogo;
    if (activeAccount?.id && activeAccount?.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${activeAccount.id}/${activeAccount.avatar}.png?size=512`;
    }

    const questsSolved = user.stats?.questsCompleted || (user.completedQuests || []).length || 0;
    const orbsEarned = user.stats?.orbs || (questsSolved * 350) || 0;
    const playtimeSaved = user.stats?.playtimeMinutes || (questsSolved * 9) || 0;
    const nitroDays = user.stats?.nitroDays || 0;

    let lastSolved = 'Never';
    if (user.stats?.lastCompletedAt) {
        const diffMs = Date.now() - user.stats.lastCompletedAt;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours >= 1) lastSolved = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        else if (diffMin >= 1) lastSolved = `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        else lastSolved = 'Just now';
    }

    const title = '# 🎮 Quest Profile';
    const subtitle = `## ${accountName}\n@${accountHandle} • Slot #${slotNumber} (Active)`;

    const header = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${title}\n${subtitle}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const bodyText = [
        '**Account Statistics**',
        `✅ **Quests Solved:** \`${questsSolved}\``,
        `🎁 **Discord Orbs Earned:** \`${orbsEarned} Orbs\``,
        `• Nitro Rewards: \`${nitroDays}d\``,
        `• Playtime Saved: \`~${playtimeSaved} minutes\``,
        `• Last Solved: \`${lastSolved}\``,
        '',
        `*Linked by* <@${discordAuthor.id}>`,
        '',
        `Switch active account anytime with \`${config.clientPrefix || '.'}switch <1|2|3>\` | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText));

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle('🎮 Quest Profile')
        .setDescription(`${subtitle}\n\n${bodyText}`)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed };
}

/**
 * Image: Quest Leaderboard UI (Matching .leaderboard UI)
 */
function buildLeaderboardCard(client, accountsList, page = 1, pageSize = 10) {
    const accentColor = config.accentColor || 0xF47FFF;
    const avatarUrl = getBotAvatar(client);

    const totalAccounts = accountsList.length;
    const totalPages = Math.max(1, Math.ceil(totalAccounts / pageSize));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = accountsList.slice(startIndex, startIndex + pageSize);

    const title = '# 🏆 Quest Leaderboard';
    const subtitle = `Top accounts by completed quests & Orbs earned • Page ${currentPage} of ${totalPages}`;

    const header = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${title}\n${subtitle}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));

    const medals = ['🥇', '🥈', '🥉'];

    const entryLines = pageItems.map((item, idx) => {
        const rank = startIndex + idx + 1;
        const medal = rank <= 3 ? medals[rank - 1] : `\`#${rank}\``;
        return [
            `${medal} **${item.accountName}** — **${item.quests}** quests • **${item.orbs}** Orbs`,
            `> Linked by <@${item.ownerId}> (Slot #${item.slot})`
        ].join('\n');
    });

    const bodyText = [
        entryLines.join('\n\n') || '*No linked accounts recorded yet.*',
        '',
        `Page ${currentPage}/${totalPages} • Total Accounts: ${totalAccounts} | Powered By [${config.developerName || 'Inferno Devs'}](${config.supportServer || 'https://discord.gg/infernodevs'})`
    ].join('\n');

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_lb_first')
            .setLabel('First')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId('btn_lb_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId('btn_lb_next')
            .setLabel('Next')
            .setStyle(currentPage >= totalPages ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages),
        new ButtonBuilder()
            .setCustomId('btn_lb_last')
            .setLabel('Last')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages)
    );

    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addSectionComponents(header)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText))
        .addActionRowComponents(buttonRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(accentColor)
        .setTitle('🏆 Quest Leaderboard')
        .setDescription(`${subtitle}\n\n${bodyText}`)
        .setThumbnail(avatarUrl);

    return { container, fallbackEmbed, actionRows: [buttonRow], currentPage, totalPages };
}

module.exports = {
    buildAccountNotLinked,
    buildAccountAuthorization,
    buildAccountLinkedSuccess,
    buildQuestSelectionList,
    buildSolvingQuestCard,
    buildQuestCompletedCard,
    buildSolvingAllQuestsCard,
    buildQuestListCard,
    buildQuestProfileCard,
    buildLeaderboardCard
};
