// TODO consider moving help text to html markup
// TODO timestamps on data panels
// TODO markup for alerts
// TODO data panel for commands

window.blir = window.blir || {};
blir.warframe = blir.warframe || {};
blir.warframe.heartbeatInterval = blir.warframe.heartbeatInterval || {};

blir.warframe.guilds = {};
blir.warframe.channels = {};

blir.warframe.alerts = [];

blir.warframe.version = '6.0';
blir.warframe.author = 'Blir';

blir.warframe.init = function(debug, bot_id) {
	blir.warframe.debug = debug;
	if (!bot_id) {
		console.error('No bot id');
		return;
	}
	blir.warframe.bot_id = bot_id;
	if (!blir.warframe.token) {
		var search = window.location.search;
		if (!search) {
			console.error('No token');
			return;
		}
		blir.warframe.token = "Bot " + search.substring(1);
		blir.discord.ajax.init();
		blir.util.init();
	}
	
	if (debug) {
		blir.util.toggleVisibilityOnClick($('#socketHeader'), $('#socketPanel'));
		blir.util.toggleVisibilityOnClick($('#ajaxRequestHeader'), $('#ajaxRequestPanel'));
		blir.util.toggleVisibilityOnClick($('#ajaxResponseHeader'), $('#ajaxResponsePanel'));
		blir.util.toggleVisibilityOnClick($('#alertsHeader'), $('#alertsPanel'));
		blir.discord.socket.initDataPanel($('#socketPanel'), 25);
		blir.discord.ajax.initRequestDataPanel($('#ajaxRequestPanel'), 25);
		blir.discord.ajax.initResponseDataPanel($('#ajaxResponsePanel'), 25);
		blir.warframe.dataPanel = blir.util.createDataPanel($('#alertsPanel'), 25);
	}
	blir.util.toggleVisibilityOnClick($('#alertEventsHeader'), $('#alertEventsPanel'));
	blir.util.toggleVisibilityOnClick($('#socketEventsHeader'), $('#socketEventsPanel'));
	blir.discord.socket.initEventDataPanel($('#socketEventsPanel'), 25, debug ? 'FINE' : 'WARNING');
	blir.warframe.alertEventsDataPanel = blir.util.createDataPanel($('#alertEventsPanel'), 25, true);
	
	setInterval(blir.warframe.checkForAlerts, 1 * 60 * 1000);
	blir.discord.setToken(blir.warframe.token);
	blir.discord.command.setBotId(blir.warframe.bot_id);
	setTimeout(function() {
		blir.warframe.checkForAlerts(true);
	}, 2500);
	blir.discord.socket.connectWebsocket(blir.warframe.onWebSocketClose, blir.warframe.onWebSocketReady);
	setInterval(blir.warframe.checkForGuilds, 2 * 60 * 1000);
	setInterval(blir.warframe.checkStatus, 5 * 60 * 1000);
	setInterval(blir.warframe.checkPlainsExpiry, 1 * 60 * 1000);
}

blir.warframe.logAlertEvent = function(msg, event) {
	var dataPanel = blir.warframe.alertEventsDataPanel;
	if (dataPanel) {
		dataPanel.addDatum(msg, event);
	}
}

blir.discord.socket.messageHandler['GUILD_CREATE'] = function(data) {
	var guild = data.d;
	guild.tenno = {};
	guild.plainsnextnight = [];
	blir.warframe.guilds[guild.id] = guild;
	console.log(`New guild: ${guild.name}`);
	for (var i = 0; i < guild.channels.length; i++) {
		var channel = guild.channels[i];
		channel.guild_id = guild.id;
		blir.warframe.channels[channel.id] = channel;
		console.log(`New channel: ${channel.name}`);
	}
	blir.warframe.loadGuildData(guild);
}

blir.warframe.onWebSocketClose = function(closeEvent, timeout) {
	//$('#status').text('disconnected');
	blir.warframe.lastCloseEventReason = closeEvent.reason;
	if (closeEvent.reason) {
		blir.warframe.sendAllChat(`Websocket was closed; Commands will not work. Will attempt to reconnect in ${timeout} seconds.`);
	}
}

blir.discord.command.channelForId = function(channelId) {
	return blir.warframe.channels[channelId];
}

blir.discord.command.guildForId = function(guildId) {
	return blir.warframe.guilds[guildId];
}

blir.discord.command.prefixForGuild = function(guildId) {
	return blir.warframe.guilds[guildId].prefix || '!wfalert';
}

blir.discord.command.registerCommandOpts({
	cmd: 'SETALERTCHANNEL',
	permReq: 'OWNER',
	handler: function(sender, args) {
		var channelName = args[0];
		if (channelName) {
			var warframeChannel;
			var channels = sender.guild.channels;
			for (var i in channels) {
				var channel = channels[i];
				if (channel.name === channelName) {
					warframeChannel = channel;
					break;
				}
			}
			if (warframeChannel) {
				sender.guild.warframeChannel = warframeChannel.id;
				blir.warframe.sendChat(sender.channel.id, 'The alert channel is now the channel with id `'
					+ warframeChannel.id + '` and name `' + warframeChannel.name + '`.');
				blir.warframe.saveGuildData(sender.guild);
			} else {
				blir.warframe.sendChat(sender.channel.id, 'No channel found with name `' + channelName + '`.');
			}
		} else {
			sender.guild.warframeChannel = undefined;
			blir.warframe.sendChat(sender.channel.id, 'Alert channel cleared.');
			blir.warframe.saveGuildData(sender.guild);
		}
	}
});

blir.discord.command.registerCommandOpts({
	cmd: 'SETSUBSCRIBERSONLY',
	permReq: 'OWNER',
	minNumArgs: 1,
	handler: function(sender, args) {
		var notifiersOnly = args[0] == 'true';
		sender.guild.notifiersOnly = notifiersOnly;
		blir.warframe.sendChat(sender.channel.id, notifiersOnly
			? 'Will now only post alerts if there are subscribers for that alert.'
			: 'Will now always post alerts.');
		blir.warframe.saveGuildData(sender.guild);
	}
});

blir.discord.command.registerCommandOpts({
	cmd: 'SETCOMMANDPREFIX',
	permReq: 'OWNER',
	minNumArgs: 1,
	handler: function(sender, args) {
		var prefix = args[0];
		sender.guild.prefix = prefix;
		blir.warframe.sendChat(sender.channel.id, `The command prefix is now: ${prefix}`);
		blir.warframe.saveGuildData(sender.guild);
	}
});

blir.warframe.initTenno = function(sender) {
	var guild = sender.guild;
	guild.tenno[sender.id] = guild.tenno[sender.id] || [];
}

blir.warframe.getTenno = function(sender) {
	return sender.guild.tenno[sender.id];
}

blir.discord.command.registerCommandOpts({
	cmd: 'PLAINS',
	handler: function(sender, args) {
		blir.warframe.getPlainsExpiry(function(expiry) {
			if (expiry <= 50) {
				blir.warframe.sendChat(sender.channel.id, `${expiry} minutes left for the current night.`);
			} else {
				blir.warframe.sendChat(sender.channel.id,
					`It is currently day. You will be pinged in ${expiry - 50} minutes when night next begins.`);
				sender.guild.plainsnextnight.push({
					id: sender.id,
					channel: sender.channel.id
				});
				blir.warframe.saveGuildData(sender.guild);
			}
		});
	}
});

blir.warframe.getPlainsExpiry = function(callback) {
	$.ajax('http://localhost/warframe/worldstate', {
		method: 'GET',
		success: function(resp, textStatus, jqXHR) {
			var worldState = JSON.parse(resp);
			var syndicateMissions = worldState.SyndicateMissions;
			var cetusSyndicate;
			for (var idx in syndicateMissions) {
				var syndicate = syndicateMissions[idx];
				if (syndicate.Tag == 'CetusSyndicate') {
					cetusSyndicate = syndicate;
					break;
				}
			}
			var expiry = parseInt(cetusSyndicate.Expiry['$date']['$numberLong']);
			var timeLeft = expiry - new Date().getTime();
			var timeLeftMins = Math.round(timeLeft / 1000 / 60);
			return callback(timeLeftMins, resp, textStatus, jqXHR);
		}
	});
}

blir.discord.command.registerCommandOpts({
	cmd: 'SUBSCRIBE',
	aliases: ['SUB'],
	minNumArgs: 1,
	handler: function(sender, args) {
		var containsText = args[0];
		blir.warframe.initTenno(sender);
		blir.warframe.getTenno(sender).push(containsText);
		blir.warframe.sendChat(sender.channel.id,
			`${sender.username}, you are now subscribed for warframe alerts containing the text "${containsText}".`);
		blir.warframe.saveGuildData(sender.guild);
		if (!sender.guild.warframeChannel) {
			blir.warframe.sendChat(sender.channel.id, 'Warning: This server has no alert channel configured. '
				+ 'You will not be notified unless one is configured.');
		}
	}
});

blir.discord.command.registerCommandOpts({
	cmd: 'UNSUBSCRIBE',
	aliases: ['UNSUB'],
	minNumArgs: 1,
	handler: function(sender, args) {
		var containsText = args[0];
		blir.warframe.initTenno(sender);
		var tenno = blir.warframe.getTenno(sender);
		var index = tenno.findIndex(function(elem) {
			return elem.toLowerCase() == containsText.toLowerCase();
		});
		if (index != -1) {
			tenno.splice(index, 1);
		}
		blir.warframe.sendChat(sender.channel.id,
			`${sender.username}, you are now unsubscribed for warframe alerts containing the text "${containsText}".`);
		blir.warframe.saveGuildData(sender.guild);
		if (!sender.guild.warframeChannel) {
			blir.warframe.sendChat(sender.channel.id, 'Warning: This server has no alert channel configured. '
				+ 'Alerts will not be posted unless one is configured.');
		}
	}
});

blir.discord.command.commandHandler['SUBSCRIPTIONS'] = function(sender, args) {
	blir.warframe.initTenno(sender);
	var subscriptions = blir.warframe.getTenno(sender);
	if (subscriptions.length == 0) {
		blir.warframe.sendChat(sender.channel.id, `${sender.username}, you have no subscriptions.`);
		return;
	}
	subscriptions = subscriptions.slice();
	subscriptions = subscriptions.sort(function(a, b) {
		a = a.toLowerCase();
		b = b.toLowerCase();
		if (a < b){
			return -1;
		}
		if (a > b){
			return 1;
		}
		return 0;
	});
	var formattedSubscriptions = '```';
	for (var i in subscriptions) {
		var subscription = subscriptions[i];
		subscription = subscription.replace(/\b([a-z])/g, function(a) {
			return a.toUpperCase();
		});
		
		function createSpaces(number) {
			var spaces = '';
			for (var i = 0; i < number; i++) {
				spaces += ' ';
			}
			return spaces;
		}
		
		var spaces = i == 0 ? '' : createSpaces(15 - subscriptions[i - 1].length);
		
		formattedSubscriptions += i % 3 == 0 ? '\n' : ',' + spaces;
		formattedSubscriptions += subscription;
	}
	formattedSubscriptions += '```';
	blir.warframe.sendChat(sender.channel.id,
		`${sender.username}, you are currently subscribed to warframe alerts containing any of the following: ${formattedSubscriptions}`);
	if (!sender.guild.warframeChannel) {
		blir.warframe.sendChat(sender.channel.id, 'Warning: This server has no alert channel configured. '
			+ 'You will not be notified unless one is configured.');
	}
}

blir.discord.command.setAliases('SUBSCRIPTIONS', ['SUBS']);

blir.discord.command.commandHandler['CURRENT'] = function(sender, args) {
	var tweets = $('#twitter-widget-0').contents().find('.timeline-Tweet');
	var now = new Date();
	var alerts = '';
	tweets.each(function(i, tweet) {
		tweet = $(tweet);
		var tweetId = tweet.attr('data-tweet-id');
		var tweetText = tweet.find('.timeline-Tweet-text').text();
		var duration = tweetText.match(/ - (\d+)m - /);
		if (duration) {
			var alertDate = new Date(tweet.find('[datetime]').attr('datetime'));
			duration = parseInt(duration[1]) * 60 * 1000;
			var timeLeft = alertDate.getTime() + duration - now.getTime();
			if (timeLeft > 0) {
				timeLeft = Math.floor(timeLeft / (60 * 1000));
				var isSubscribed = false;
				var subscriptions = blir.warframe.getTenno(sender);
				for (var i in subscriptions) {
					var subscription = subscriptions[i];
					isSubscribed = isSubscribed || tweetText.match(new RegExp(subscription, 'i'));
					tweetText = tweetText.replace(new RegExp(subscription, 'gi'), ' `$&` ');
				}
				if (timeLeft <= 10) {
					timeLeft = `(${timeLeft} minutes left :exclamation: )`;
				} else {
					timeLeft = `(${timeLeft} minutes left)`;
				}
				if (isSubscribed) {
					alerts += ':warning: ';
				}
				alerts += tweetText + ' ' + timeLeft + '\n';
			}
		} else {
			// ignore tweets with no duration, the bot has no way to know when they end
			//alerts += tweetText + '\n';
			// TODO use worldState API instead for this reason
		}
	});
	blir.warframe.sendChat(sender.channel.id, alerts ? alerts : 'No alerts at the moment.');
}

blir.discord.command.commandHandler['SIMULATEALERT'] = function(sender, args) {
	if (blir.warframe.debug) {
		if (args.length > 2) {
			var tweetText = args[0];
			var tweetId = args[1];
			var silent = args[2] == 'true';
			blir.warframe.processAlert(tweetText, tweetId, silent);
		} else {
			blir.warframe.sendChat(sender.channel.id, 'Invalid number of arguments.');
		}
	} else {
		blir.discord.command.invalidCommandHandler(sender, 'SIMULATEALERT');
	}
}

blir.discord.command.commandHandler['INFO'] = function(sender, args) {
	blir.warframe.sendChat(sender.channel.id, 'Greetings, Tenno ' + sender.username + '!\n'
		+ 'This bot was written from scratch in JavaScript by Blir.\n'
		+ 'GitHub Repository: https://github.com/Blir/Warframe-Alerts\n'
		+ 'This bot complies with the Discord Bot Best Practices which you can see at https://github.com/meew0/discord-bot-best-practices\n'
		+ 'Version: ' + blir.warframe.version);
	blir.warframe.sendChat(sender.channel.id, 'Available commands:\n'
		+ '    setAlertChannel [_name of channel to post alerts to_]\n'
		+ '    subscribe <_text that the alert must contain_>\n'
		+ '    unsubscribe <_text that the alert must contain_>\n'
		+ '    subscriptions\n'
		+ '    current\n'
		+ '    plains\n'
		+ '    changelog');
	blir.warframe.sendChat(sender.channel.id, ''
		+ 'This bot will post messages in chat for every alert to the designated alert channel. '
		+ 'If the alert description contains text to which you are subscribed, '
		+ 'you will be mentioned in the chat message.');
}

blir.discord.command.commandHandler[''] = function(sender, args) {
	blir.warframe.sendChat(sender.channel.id, 'Available commands:\n'
		+ '    setCommandPrefix <prefix>\n'
		+ '    setSubscribersOnly <true|false>\n'
		+ '    setAlertChannel [_name of channel to post alerts to_]\n'
		+ '    subscribe <_text that the alert must contain_>\n'
		+ '    unsubscribe <_text that the alert must contain_>\n'
		+ '    subscriptions\n'
		+ '    current\n'
		+ '    plains\n'
		+ '    changelog');
}

blir.discord.command.setAliases('INFO', ['HELP', '?']);

blir.discord.command.commandHandler['CHANGELOG'] = function(sender, args) {
	blir.warframe.sendChat(sender.channel.id, ''
		+ 'v6.0 Added plains command - lets you know when night begins\n'
		+ 'v5.0 Better formatting from `subscriptions` command, '
		+ 'now indicates matching text in alerts in `current` command\n'
		+ 'v4.0 Deprecated use of localStorage, '
		+ 'now communicating with HTTP Server to save data to disk as JSON\n'
		+ 'v3.0 Added setSubscribersOnly and setCommandPrefix commands\n'
		+ 'v2.2: Will no longer show alerts that do not have a duration '
			+ 'for the `current` command because the bot has no way to know when they end\n'
		+ 'v2.1: Will now post available commands when prefix is entered\n'
		+ 'v2.0: Added current and changelog commands\n'
		+ 'v1.0: Initial version (of course)');
}

blir.discord.command.invalidCommandHandler = function(sender, cmd) {
	blir.warframe.sendChat(sender.channel.id, 'Invalid command: ' + cmd
		+ '\nTry `help` for a list of commands.');
}

blir.warframe.saveGuildsData = function() {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		blir.warframe.saveGuildData(guild);
	}
}

blir.warframe.saveGuildData = function(guild) {
	var data = {
		bot_id: blir.warframe.bot_id,
		guild_id: guild.id,
		data: {
			warframeChannel: guild.warframeChannel,
			notifiersOnly: guild.notifiersOnly,
			prefix: guild.prefix,
			tenno: guild.tenno,
			plainsnextnight: guild.plainsnextnight
		}
	};
	$.ajax( 'http://localhost/warframe/saveguilddata', {
		method: 'POST',
		data: JSON.stringify(data)
	});
}

blir.warframe.loadGuildsData = function() {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		blir.warframe.loadGuildData(guild);
	}
}

blir.warframe.loadGuildData = function(guild) {
	var data = {
		bot_id: blir.warframe.bot_id,
		guild_id: guild.id
	};
	$.ajax( 'http://localhost/warframe/loadguilddata', {
		method: 'POST',
		data: JSON.stringify(data),
		success: function(resp) {
			if (resp) {
				resp = JSON.parse(resp);
				guild.warframeChannel = resp.warframeChannel;
				guild.notifiersOnly = resp.notifiersOnly;
				guild.prefix = resp.prefix;
				guild.tenno = resp.tenno;
				if (resp.plainsnextnight)
					guild.plainsnextnight = resp.plainsnextnight;
			}
		}
	});
}

blir.warframe.onWebSocketReady = function(data) {
	if (blir.warframe.lastCloseEventReason) {
		blir.warframe.sendAllChat('Ready for commands.');
	}
	//$('#status').text('connected');
}

blir.warframe.sendAllChat = function(chat) {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		if (guild.warframeChannel) {
			blir.discord.ajax.ajax( `channels/${guild.warframeChannel}/messages`, {
				method: 'POST',
				data: {
					content: chat
				}
			});
		}
	}
}

blir.warframe.sendChat = function(channelId, chat) {
	blir.discord.ajax.ajax( `channels/${channelId}/messages`, {
		method: 'POST',
		data: {
			content: chat
		}
	});
}

blir.warframe.isNewAlert = function(tweetId) {
	var alerts = blir.warframe.alerts;
	for (var i in alerts) {
		if (alerts[i] === tweetId) {
			return false;
		}
	}
	alerts.push(tweetId);
	return true;
}

blir.warframe.checkForAlerts = function(silent) {
	blir.warframe.logAlertEvent('Checking for alerts');
	var tweets = $('#twitter-widget-0').contents().find('.timeline-Tweet');
	tweets.each(function(i, tweet) {
		blir.warframe.processTweet($(tweet), silent);
	});
}

blir.warframe.processTweet = function(tweet, silent) {
	var tweetText = tweet.find('.timeline-Tweet-text').text();
	var tweetId = tweet.attr('data-tweet-id');
	var isNew = blir.warframe.isNewAlert(tweetId);
	if (isNew) {
		blir.warframe.processAlert(tweetText, tweetId, silent);
	}
}

blir.warframe.processAlert = function(tweetText, tweetId, silent) {
	blir.warframe.lastAlertTime = new Date();
	var dataPanel = blir.warframe.dataPanel;
	if (dataPanel) {
		dataPanel.addDatum(tweetId, tweetText);
	} else {
		console.log(`new alert: ${tweetId}: ${tweetText}`);
	}
	if (!silent) {
		for (var i in blir.warframe.guilds) {
			var guild = blir.warframe.guilds[i];
			if (guild.warframeChannel) {
				blir.warframe.notifyGuild(guild, tweetText);
			}
		}
	}
}

blir.warframe.notifyGuild = function(guild, tweetText) {
	var notifiers = blir.warframe.getNotifiers(guild.tenno, tweetText);
	if (notifiers.length != 0 || !guild.notifiersOnly) {
		var msg = blir.warframe.getNotifierMsg(notifiers);
		blir.warframe.sendChat(guild.warframeChannel, msg + ' ' + tweetText);
	}
}

blir.warframe.getNotifiers = function(tenno, tweetText) {
	var notifiers = [];
	for (var id in tenno) {
		if (blir.warframe.notify(tenno[id], tweetText)) {
			notifiers.push(id);
		}
	}
	return notifiers;
}

blir.warframe.getNotifierMsg = function(notifiers) {
	var msg = '';
	var first = true;
	for (var id in notifiers) {
		if (first) {
			first = false;
		} else {
			msg += ', ';
		}
		msg += `<@${notifiers[id]}>`;
	}
	return msg;
}

blir.warframe.notify = function(subscriptions, tweetText) {
	if (subscriptions) {
		for (var i in subscriptions) {
			var subscription = subscriptions[i];
			if (tweetText.toLowerCase().indexOf(subscription.toLowerCase()) != -1) {
				return true;
			}
		}
	}
	return false;
}

blir.warframe.checkStatus = function() {
	var now = new Date();
	var dif = now.getTime() - blir.warframe.lastAlertTime.getTime();
	var mins = dif == 0 ? 0 : dif / 1000 / 60;
	mins = Math.round(mins);
	blir.discord.socket.statusUpdate(`alert${mins}m`);
}

blir.warframe.checkPlainsExpiry = function() {
	blir.warframe.getPlainsExpiry(function(expiry) {
		var guildsToUpdate = [];
		if (expiry > 50) return;
		for (var guildIdx in blir.warframe.guilds) {
			var guild = blir.warframe.guilds[guildIdx];
			var updateGuild = false;
			for (var pnnIdx in guild.plainsnextnight) {
				var pnn = guild.plainsnextnight[pnnIdx];
				if (pnn) {
					// TODO somewhere null is added to plainsnextnight
					var id = pnn.id;
					var channel = pnn.channel;
					blir.warframe.sendChat(channel, `<@${id}>, night has begun!`);
					updateGuild = true;
				}
			}
			if (updateGuild) {
				guild.plainsnextnight = [];
				guildsToUpdate.push(guild);
			}
		}
		for (var guildIdx in guildsToUpdate) {
			var guild = guildsToUpdate[guildIdx];
			blir.warframe.saveGuildData(guild);
		}
	});
}