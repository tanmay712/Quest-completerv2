const { Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const db = require('../lib/services/database.js');
const discordApi = require('../lib/services/discordApi.js');
const questEngine = require('../lib/services/questEngine.js');
const { buildAccountLinkedSuccess } = require('../lib/functions/questUI.js');

/** @type {import('../../lib/types/index.ts').Event} */
module.exports = {
    name: 'onInteraction',
    event: Events.InteractionCreate,
    once: false,

    async execute(client, interaction) {
        // 1. Handle Modal Submissions (Link Token Modal)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_link_token') {
                try {
                    await interaction.deferReply({ flags: 'Ephemeral' });
                } catch (e) {
                    return; // Interaction expired or already handled
                }

                const tokenInput = interaction.fields.getTextInputValue('token_input')?.trim();
                const userId = interaction.user.id;
                const user = db.getUser(userId);

                let targetSlot = user.activeSlot || 1;
                const emptySlot = Object.keys(user.slots).find(k => user.slots[k] === null);
                if (emptySlot) targetSlot = Number(emptySlot);

                let accountName = interaction.user.username;

                const validation = await discordApi.validateUserToken(tokenInput);

                if (!validation.valid) {
                    return interaction.editReply({
                        content: `❌ Token validation failed: \`${validation.error}\`. Please double-check your token.`
                    }).catch(() => {});
                }

                accountName = validation.user.globalName || validation.user.username;
                db.linkAccount(userId, targetSlot, {
                    token: tokenInput,
                    id: validation.user.id,
                    username: validation.user.username,
                    globalName: validation.user.globalName,
                    avatar: validation.user.avatar,
                    nitroType: validation.user.nitroType
                });

                const successCard = buildAccountLinkedSuccess(client, accountName, targetSlot);
                try {
                    return await interaction.editReply({
                        components: [successCard.container],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch {
                    return await interaction.editReply({
                        embeds: [successCard.fallbackEmbed]
                    }).catch(() => {});
                }
            }
            return;
        }

        // 2. Button Interactions (Link Token, How to Link, Cancel Quest)
        if (interaction.isButton()) {
            if (interaction.customId === 'btn_open_link_modal') {
                try {
                    const modal = new ModalBuilder()
                        .setCustomId('modal_link_token')
                        .setTitle('Link Discord Token');

                    const tokenInput = new TextInputBuilder()
                        .setCustomId('token_input')
                        .setLabel('Discord User Token')
                        .setPlaceholder('Paste your Discord account token here...')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(tokenInput));
                    return await interaction.showModal(modal);
                } catch (err) {
                    // Ignore if interaction expired
                    return;
                }
            }

            if (interaction.customId === 'btn_how_to_link') {
                try {
                    return await interaction.reply({
                        content: [
                            '### 📖 How to get your Discord Token:',
                            '1. Open Discord in your browser (**Chrome / Edge / Firefox**)',
                            '2. Press `Ctrl + Shift + I` (or `Cmd + Option + I` on Mac) to open DevTools',
                            '3. Go to the **Network** tab',
                            '4. Type `/api` in the filter box and send any message in Discord',
                            '5. Click any request, go to **Headers**, and copy the `Authorization` header value.',
                            '',
                            '⚠️ *Never share your token with other users. O R B Y T E encrypts your token locally with AES-256.*'
                        ].join('\n'),
                        flags: 'Ephemeral'
                    });
                } catch (e) {
                    return;
                }
            }

            if (interaction.customId === 'btn_cancel_quest' || interaction.customId === 'btn_cancel_questall') {
                questEngine.cancelQuest(interaction.user.id);
                try {
                    return await interaction.reply({
                        content: '🛑 **Quest automation cancelled by user.**',
                        flags: 'Ephemeral'
                    });
                } catch (e) {
                    return;
                }
            }

            // Other buttons handled by local collectors
            return;
        }

        // 3. String select menus handled by collectors
        if (interaction.isStringSelectMenu()) return;

        // 4. Slash Commands and Context Commands
        if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand() && !interaction.isAutocomplete()) return;

        if (!interaction.guild) return;
        const Command = client.slashCommands.get(interaction.commandName);

        if (!Command) return;

        const embed = new EmbedBuilder().setColor('Red');
        if (Command.devOnly && !client.developer.includes(interaction.user.id)) {
            return interaction.reply({ embeds: [embed.setDescription(`Warning! Access Restricted Developer Command Detected.`)], flags: 'Ephemeral' });
        }
        if (Command.userPermissions && Command.userPermissions.length !== 0) {
            if (!interaction.member.permissions.has(Command.userPermissions)) {
                return interaction.reply({ embeds: [embed.setDescription(`You need \`${Command.userPermissions.join(', ')}\` permission(s) to execute this command!`)], flags: 'Ephemeral' });
            }
        }
        if (Command.botPermissions && Command.botPermissions.length !== 0) {
            if (!interaction.guild.members.me.permissions.has(Command.botPermissions)) {
                return interaction.reply({ embeds: [embed.setDescription(`I need \`${Command.botPermissions.join(', ')}\` permission(s) to execute this command!`)], flags: 'Ephemeral' });
            }
        }

        Command.execute(client, interaction);
    }
};
