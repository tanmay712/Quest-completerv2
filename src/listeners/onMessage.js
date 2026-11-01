const { Events, EmbedBuilder } = require('discord.js');
const { clientPrefix } = require('../lib/config.json');
/** @type {import('../lib/types/index.ts').Event} */

module.exports = {
    name: 'onMessage', event: Events.MessageCreate, once: false,

    async execute(client, message) {
        if (message.channel.type !== 0) return;
        if (message.author.bot || !message.guild || !message.content.toLowerCase().startsWith(clientPrefix)) return;

        const [cmd, ...args] = message.content.slice(clientPrefix.length).trim().split(/ +/g);
        const Command = client.messageCommands.get(cmd.toLowerCase()) || client.messageCommands.find(c => c.alias?.includes(cmd.toLowerCase()));

        if (!Command) return;

        const embed = new EmbedBuilder().setColor('Red')
        if (Command.devOnly && !client.developer.includes(message.author.id)) return;
        if (Command.userPermissions && Command.userPermissions.length !== 0) {
            if (!message.member.permissions.has(Command.userPermissions)) return message.reply({ embeds: [embed.setDescription(`You need \`${Command.userPermissions || Command.userPermissions.join(", ")}\` permission(s) to execute this command!`)] });
        } if (Command.botPermissions && Command.botPermissions.length !== 0) {
            if (!message.guild.members.me.permissions.has(Command.botPermissions)) return message.reply({ embeds: [embed.setDescription(`I need \`${Command.botPermissions || Command.botPermissions.join(", ")}\` permission(s) to execute this command!`)] });
        }
        Command.execute(client, message, args);
    }
}