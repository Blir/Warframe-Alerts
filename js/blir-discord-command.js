// DEPENDENCIES: blir-discord-ajax, blir-discord-socket, blir-util

window.blir = window.blir || {};
blir.discord = blir.discord || {};
blir.discord.command = blir.discord.command || {};

blir.discord.command.commandHandler = {};

blir.discord.command.version = '1.0';
blir.discord.command.author = 'Blir';

blir.discord.command.setBotId = function(botId) {
	blir.discord.command.botId = botId;
}

blir.discord.command.setAliases = function(cmd, aliases) {
	var cmdHandler = blir.discord.command.commandHandler[cmd];
	for (var i in aliases) {
		var alias = aliases[i];
		if (blir.discord.command.commandHandler[alias]) {
			throw Error('Command ' + alias + ' already in use');
		} else {
			blir.discord.command.commandHandler[alias] = cmdHandler;
		}
	}
}

blir.discord.command.registerCommandOpts = function(opts) {
	blir.discord.command.registerCommand(opts.cmd, opts.handler, opts.aliases, opts.minNumArgs, opts.permReq);
}

blir.discord.command.registerCommand = function(cmd, handler, aliases, minNumArgs, permReq) {
	var wrapperHandler = function(sender, args) {
		if (sender.guild.owner_id != sender.id) {
			if (permReq == 'OWNER') {
				blir.discord.sendChat(sender.channel.id, 'You must be the owner of the server to issue this command.');
				return 'Not authorized';
			} else if (permReq) {
				var getPerms = blir.discord.command.getPermissions;
				if (getPerms) {
					var perms = getPerms(sender);
					if (perms != permReq) {
						blir.discord.sendChat(sender.channel.id, 'You are not authorized to use this command.');
						return 'Not authorized';
					}
				} else {
					console.error('Permissions not supported');
					return 'Not authorized - permissions not supported';
				}
			}
		}
		if (!minNumArgs || args.length >= minNumArgs) {
			try {
				return handler(sender, args) || 'Success';
			} catch (ex) {
				blir.discord.sendChat(sender.channel.id, 'An error occurred processing the command: ' + ex);
				return 'Exception: ' + ex;
			}
		} else {
			blir.discord.sendChat(sender.channel.id, 'Invalid number of arguments.');
			return 'Invalid number of arguments';
		}
	};
	blir.discord.command.commandHandler[cmd] = wrapperHandler;
	if (aliases) {
		blir.discord.command.setAliases(cmd, aliases);
	}
}

blir.discord.socket.messageHandler['MESSAGE_CREATE'] = function(data) {
	var content = data.d.content;
	var author = data.d.author;
	var channelId = data.d.channel_id;
	var prefixForGuild = blir.discord.command.prefixForGuild;
	if (!prefixForGuild) {
		throw Error('prefixForGuild function missing!');
	}
	var botId = blir.discord.command.botId;
	if (!botId) {
		throw Error('Bot Id missing!');
	}
	var channelForId = blir.discord.command.channelForId;
	if (channelForId) {
		author.channel = channelForId(channelId);
	}
	var guildForId = blir.discord.command.guildForId;
	if (guildForId) {
		// TODO refactor to not rely on guild_id
		// guild_id is not populated by Discord
		// TODO frequent problem of author.channel not defined
		author.guild = guildForId(author.channel.guild_id);
	}
	var prefix = prefixForGuild(author.channel.guild_id);
	if (!prefix) {
		throw Error('Prefix missing!');
	}
	// TODO for prefixes that are only symbols - do not require a space
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
			var result = cmdHandler(author, args);
			if (blir.discord.command.audit) {
				blir.discord.command.audit(author, cmd + ' ' + args, result);
			}
		} else if (blir.discord.command.invalidCommandHandler) {
			blir.discord.command.invalidCommandHandler(author, cmd);
		}
	}
}