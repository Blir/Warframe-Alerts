// TODO consider moving help text to html markup

window.blir = window.blir || {};
blir.warframe = blir.warframe || {};
blir.warframe.heartbeatInterval = blir.warframe.heartbeatInterval || {};

blir.warframe.guilds = {};
blir.warframe.channels = {};

blir.warframe.alerts = [];

blir.warframe.version = '2.0';
blir.warframe.author = 'Blir';
blir.warframe.bot_id = '171482495504613378';

blir.warframe.init = function() {
	if (!blir.warframe.token) {
		blir.warframe.token = window.location.search.substring(1);
	}
	blir.discord.ajax.init();
	setInterval(blir.warframe.checkForAlerts, 1 * 60 * 1000);
	blir.discord.setToken(blir.warframe.token);
	blir.discord.command.setCommandPrefix('!wfalert');
	blir.discord.command.setBotId(blir.warframe.bot_id);
	setTimeout(function() {
		blir.warframe.checkForAlerts(true);
	}, 2500);
	blir.warframe.checkForGuilds();
	blir.discord.socket.connectWebsocket(blir.warframe.onWebSocketClose, blir.warframe.onWebSocketReady)
	setInterval(blir.warframe.checkForGuilds, 1 * 60 * 1000);
	blir.util.toggleVisibilityOnClick($('#socketHeader'), $('#socketPanel'));
	blir.util.toggleVisibilityOnClick($('#ajaxHeader'), $('#ajaxPanel'));
	blir.util.toggleVisibilityOnClick($('#alertsHeader'), $('#alertsPanel'));
	blir.discord.socket.initDataPanel($('#socketPanel'), 25);
	blir.discord.ajax.initDataPanel($('#ajaxPanel'), 25);
	blir.warframe.dataPanel = blir.util.createDataPanel($('#alertsPanel'), 25);
}

blir.warframe.checkForGuilds = function() {
	blir.discord.ajax.ajax('users/@me/guilds', {
		silent: true,
		method: 'GET',
		success: blir.warframe.onGetGuildsSuccess
	});
}

blir.warframe.onGetGuildsSuccess = function(resp) {
	for (var i in resp) {
		var guild = resp[i];
		guild.tenno = {};
		guild.channels = {};
		if (!blir.warframe.guilds[guild.id]) {
			console.log('new guild: ' + guild.name);
			blir.warframe.guilds[guild.id] = guild;
		}
		blir.discord.ajax.ajax('guilds/' + guild.id + '/channels', {
			silent: true,
			method: 'GET',
			success: blir.warframe.onGetChannelsSuccess
		});
	}
	blir.warframe.loadSubscriptions();
	blir.warframe.loadWarframeChannels();
}

blir.warframe.onGetChannelsSuccess = function(resp) {
	for (var i in resp) {
		var channel = resp[i];
		if (!blir.warframe.channels[channel.id]) {
			var guild = blir.warframe.guilds[channel.guild_id];
			console.log('new channel: ' + channel.name + ' for guild: ' + guild.name);
			blir.warframe.channels[channel.id] = channel;
			guild.channels[channel.id] = channel;
		}
	}
}

blir.warframe.onWebSocketClose = function() {
	//$('#status').text('disconnected');
	blir.warframe.sendAllChat('websocket was closed. commands will not work. will attempt to reconnect in 5 seconds.');
}

blir.discord.command.channelForId = function(channelId) {
	return blir.warframe.channels[channelId];
}

blir.discord.command.guildForId = function(guildId) {
	return blir.warframe.guilds[guildId];
}

blir.discord.command.commandHandler['SETALERTCHANNEL'] = function(sender, args) {
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
			blir.warframe.sendChat(sender.channel.id, 'The alert channel is now the channel with id '
				+ warframeChannel.id + ' and name ' + warframeChannel.name + '.');
			blir.warframe.saveWarframeChannels();
		} else {
			blir.warframe.sendChat(sender.channel.id, 'No channel found with name ' + channelName + '.');
		}
	} else {
		sender.guild.warframeChannel = undefined;
		blir.warframe.sendChat(sender.channel.id, 'Alert channel cleared.');
		blir.warframe.saveWarframeChannels();
	}
}

blir.warframe.initTenno = function(sender) {
	var guild = blir.warframe.guilds[sender.guild.id];
	guild.tenno[sender.id] = guild.tenno[sender.id] || [];
}

blir.warframe.getTenno = function(sender) {
	return blir.warframe.guilds[sender.guild.id].tenno[sender.id];
}

blir.discord.command.commandHandler['SUBSCRIBE'] = function(sender, args) {
	var containsText = args[0];
	if (containsText) {
		blir.warframe.initTenno(sender);
		blir.warframe.getTenno(sender).push(containsText);
		blir.warframe.sendChat(sender.channel.id, sender.username +
			', you are now subscribed for warframe alerts containing the text "' + containsText + '".');
		blir.warframe.saveSubscriptions();
		if (!sender.guild.warframeChannel) {
			blir.warframe.sendChat(sender.channel.id, 'Warning: This server has no alert channel configured. '
				+ 'You will not be notified unless one is configured.');
		}
	} else {
		blir.warframe.sendChat(sender.channel.id, 'Invalid number of arguments.');
	}
}

blir.discord.command.setAliases('SUBSCRIBE', ['SUB']);

blir.discord.command.commandHandler['UNSUBSCRIBE'] = function(sender, args) {
	var containsText = args[0];
	if (containsText) {
		blir.warframe.initTenno(sender);
		var tenno = blir.warframe.getTenno(sender);
		var index = tenno.indexOf(containsText);
		if (index != -1) {
			tenno.splice(index, 1);
		}
		blir.warframe.sendChat(sender.channel.id, sender.username +
			', you are now unsubscribed for warframe alerts containing the text "' + containsText + '".');
		blir.warframe.saveSubscriptions();
		if (!sender.guild.warframeChannel) {
			blir.warframe.sendChat(sender.channel.id, 'Warning: This server has no alert channel configured. '
				+ 'Alerts will not be posted unless one is configured.');
		}
	} else {
		blir.warframe.sendChat(sender.channel.id, 'Invalid number of arguments.');
	}
}

blir.discord.command.setAliases('UNSUBSCRIBE', ['UNSUB']);

blir.discord.command.commandHandler['SUBSCRIPTIONS'] = function(sender, args) {
	blir.warframe.initTenno(sender);
	var subscriptions = blir.warframe.getTenno(sender).toString();
	blir.warframe.sendChat(sender.channel.id, sender.username +
		', you are currently subscribed to warframe alerts containing any of the following: ' + subscriptions);
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
				alerts += tweetText + ' (' + timeLeft + ' minutes left)\n';
			}
		} else {
			alerts += tweetText + '\n';
		}
	});
	blir.warframe.sendChat(sender.channel.id, alerts);
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
		+ '    changelog');
	blir.warframe.sendChat(sender.channel.id, ''
		+ 'This bot will post messages in chat for every alert to the designated alert channel. '
		+ 'If the alert description contains text to which you are subscribed, '
		+ 'you will be mentioned in the chat message.');
}

blir.discord.command.setAliases('INFO', ['HELP', '?']);

blir.discord.command.commandHandler['CHANGELOG'] = function(sender, args) {
	blir.warframe.sendChat(sender.channel.id, ''
		+ 'v2.0: Added current and changelog commands\n'
		+ 'v1.0: Initial version (of course)');
}

blir.warframe.saveSubscriptions = function() {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		localStorage.setItem('guildTenno ' + guild.id, JSON.stringify(guild.tenno));
	}
}

blir.warframe.saveWarframeChannels = function() {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		var key = 'guildWarframeAlertChannel ' + guild.id;
		if (guild.warframeChannel) {
			localStorage.setItem(key, guild.warframeChannel);
		} else {
			localStorage.removeItem(key);
		}
	}
}

blir.warframe.loadSubscriptions = function() {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		var tenno = localStorage.getItem('guildTenno ' + guild.id);
		if (tenno) {
			tenno = JSON.parse(tenno);
			if (tenno) {
				guild.tenno = tenno;
			}
		}
	}
}

blir.warframe.loadWarframeChannels = function() {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		var warframeChannel = localStorage.getItem('guildWarframeAlertChannel ' + guild.id);
		if (warframeChannel) {
			guild.warframeChannel = warframeChannel;
		}
	}
}

blir.warframe.onWebSocketReady = function(data) {
	blir.warframe.sendAllChat('Ready for commands.');
	//$('#status').text('connected');
}

blir.warframe.sendAllChat = function(chat) {
	for (var i in blir.warframe.guilds) {
		var guild = blir.warframe.guilds[i];
		if (guild.warframeChannel) {
			blir.discord.ajax.ajax( 'channels/' + guild.warframeChannel + '/messages', {
				method: 'POST',
				data: {
					content: chat
				}
			});
		}
	}
}

blir.warframe.sendChat = function(channelId, chat) {
	blir.discord.ajax.ajax( 'channels/' + channelId + '/messages', {
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
	console.log('checking for alerts...');
	var tweets = $('#twitter-widget-0').contents().find('.timeline-Tweet');
	tweets.each(function(i, tweet) {
		blir.warframe.processAlert($(tweet), silent);
	});
}

blir.warframe.processAlert = function(tweet, silent) {
	var tweetText = tweet.find('.timeline-Tweet-text').text();
	var tweetId = tweet.attr('data-tweet-id');
	var isNew = blir.warframe.isNewAlert(tweetId);
	if (isNew) {
		var dataPanel = blir.warframe.dataPanel;
		if (dataPanel) {
			dataPanel.addDatum(tweetId, tweetText);
		} else {
			console.log('new alert: ' + tweetId + ': ' + tweetText);
		}
	}
	if (!silent && isNew) {
		for (var i in blir.warframe.guilds) {
			var guild = blir.warframe.guilds[i];
			if (guild.warframeChannel) {
				var notifiers = blir.warframe.getNotifiers(guild.tenno, tweetText);
				blir.warframe.sendChat(guild.warframeChannel, notifiers + ' ' + tweetText);
			}
		}
	}
}

blir.warframe.getNotifiers = function(tenno, tweetText) {
	var notifiers = '';
	var first = true;
	for (var id in tenno) {
		if (blir.warframe.notify(tenno[id], tweetText)) {
			if (first) {
				first = false;
			} else {
				notifiers += ', ';
			}
			notifiers += '<@' + id + '>';
		}
	}
	return notifiers;
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