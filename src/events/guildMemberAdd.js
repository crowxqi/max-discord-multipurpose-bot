const { statements } = require('../database/db');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const data = statements.getGuild.get(member.guild.id);
        if (!data) return;

        if (!member.user.bot && data.autorole_user) {
            member.roles.add(data.autorole_user).catch(() => { });
        }
        if (member.user.bot && data.autorole_bot) {
            member.roles.add(data.autorole_bot).catch(() => { });
        }
    }
};
