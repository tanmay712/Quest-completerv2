const { ApplicationCommandType } = require('discord.js');
/** @type {import('../lib/types/index.ts').SlashCommand} */

module.exports = {
  name: 'Avatar',
  type: ApplicationCommandType.User,

  botPermissions: ['SendMessages'], userPermissions: ['SendMessages'], devOnly: false,

  async execute(client, interaction) {
    const target = interaction.guild.members.cache.get(interaction.targetId) || await interaction.guild.members.fetch(interaction.targetId);
    interaction.reply({ content: target.displayAvatarURL({ extension: 'png', size: 4096 }), flags: 'Ephemeral' });
  }
}