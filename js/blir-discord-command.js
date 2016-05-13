// DEPENDENCIES: blir-discord-socket, blir-util

window.blir = window.blir || {};
blir.discord = blir.discord || {};
blir.discord.command = blir.discord.command || {};

blir.discord.command.commandHandler = {};

blir.discord.command.version = '1.0';
blir.discord.command.author = 'Blir';

blir.discord.command.setCommandPrefix = function(prefix) {
	blir.discord.command.prefix = prefix;
}

blir.discord.command.setBotId = function(botId) {
	blir.discord.command.botId = botId;
}

blir.discord.command.setAliases = function(cmd, aliases) {
	var cmdHandler = blir.discord.command.commandHandler[cmd];
	for (var i in aliases) {
		var alias = aliases[i];
		blir.discord.command.commandHandler[alias] = cmdHandler;
	}
}

blir.discord.socket.messageHandler['MESSAGE_CREATE'] = function(data) {
	var content = data.d.content;
	var author = data.d.author;
	var channelId = data.d.channel_id;
	var prefix = blir.discord.command.prefix;
	var botId = blir.discord.command.botId;
	if (!prefix) {
		throw Error('Prefix missing!');
	}
	if (!botId) {
		throw Error('Bot Id missing!');
	}
	var channelForId = blir.discord.command.channelForId;
	if (channelForId) {
		author.channel = channelForId(channelId);
	}
	var guildForId = blir.discord.command.guildForId;
	if (guildForId) {
		author.guild = guildForId(author.channel.guild_id);
	}
	if (author.id != botId && content.indexOf(prefix) == 0) {
		content = content.substring(prefix.length + 1);
		var delim = content.indexOf(' ');
		var cmd = delim > 0 ? content.substring(0, delim) : content;
		cmd = cmd.toUpperCase();
		var args = delim > 0 ? content.substring(delim + 1) : '';
		args = blir.util.parseArgs(args);
		console.log('Command detected: ' + cmd);
		var cmdHandler = blir.discord.command.commandHandler[cmd];
		if (cmdHandler) {
			cmdHandler(author, args);
		}
	}
}