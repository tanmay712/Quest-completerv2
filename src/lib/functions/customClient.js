require('dotenv').config();
const { developerIds } = require('../config.json');
const { Client, Collection, version } = require('discord.js');

module.exports.CustomClient = class CustomClient extends Client {
    messageCommands = new Collection();
    slashCommands = new Collection();
    developer = developerIds;

    start() {
        console.log(`◌ discord.js ${version} | ◌ NodeJs ${process.versions.node} ── version*`);
        const token = process.env.DISCORD_TOKEN;
        if (!token) throw new Error('Missing DISCORD_TOKEN. Set it in your .env file.');
        this.login(token);
    }
}