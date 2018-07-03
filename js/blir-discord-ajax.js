// DEPENDENCIES: jQuery

// TODO wrap ajax with arg parsing to warn about undefineds

window.blir = window.blir || {};
blir.discord = blir.discord || {};
blir.discord.ajax = blir.discord.ajax || {};

blir.discord.ajax.statusHandler = {};

blir.discord.ajax.queue = [];

blir.discord.ajax.version = '1.0';
blir.discord.ajax.author = 'Blir';

blir.discord.ajax.canSend = true;

blir.discord.ajax.init = function(jQuery) {
	blir.discord.jQuery = jQuery || $;
	setInterval(blir.discord.ajax.processQueue, 250);
}

blir.discord.ajax.initRequestDataPanel = function(elem, maxSize) {
	blir.discord.ajax.requestDataPanel = blir.util.createDataPanel(elem, maxSize);
}

blir.discord.ajax.initResponseDataPanel = function(elem, maxSize) {
	blir.discord.ajax.responseDataPanel = blir.util.createDataPanel(elem, maxSize);
}

blir.discord.ajax.ajax = function() {
	blir.discord.ajax.queue.push(arguments);
}

blir.discord.ajax.processQueue = function() {
	if (blir.discord.ajax.canSend) {
		var args = blir.discord.ajax.queue.shift();
		if (args) {
			blir.discord.ajax.process.apply(this, args);
		}
	}
}

blir.discord.ajax.process = function(url, options) {
	options = options || {};
	if (!options.silent) {
		var reqDataPanel = blir.discord.ajax.requestDataPanel;
		if (reqDataPanel) {
			reqDataPanel.addDatum(url, options);
		} else {
			console.log('processing ' + url);
		}
	}
	var token = blir.discord.ajax.token;
	if (token) {
		options.headers = options.headers || {};
		options.headers.Authorization = token;
	}
	var errorFn = options.error || function(errorFn, ajaxArgs, jqXHR, textStatus, errorThrown) {
		console.error('error on request ' + url);
		console.error('textStatus was ' + textStatus);
		console.error('errorThrown was ' + errorThrown);
		console.error('responseText was ' + jqXHR.responseText);
		console.error('status was ' + jqXHR.status);
	};
	var successFn = options.success;
	options.success = blir.discord.ajax.success.bind(this, url, successFn, options.silent);
	options.error = blir.discord.ajax.error.bind(this, errorFn, arguments);
	blir.discord.jQuery.ajax('https://discordapp.com/api/' + url, options);
}

blir.discord.ajax.success = function(url, successFn, silent, resp, textStatus, jqXHR) {
	if (!silent) {
		var respDataPanel = blir.discord.ajax.responseDataPanel;
		if (respDataPanel) {
			respDataPanel.addDatum(url, resp);
		}
	}
	if (successFn) {
		successFn(resp, textStatus, jqXHR);
	}
}

blir.discord.ajax.error = function(errorFn, ajaxArgs, jqXHR, textStatus, errorThrown) {
	var statusHandler = blir.discord.ajax.statusHandler[jqXHR.status];
	if (statusHandler) {
		statusHandler.apply(this, arguments);
	}
	errorFn(errorFn, ajaxArgs, jqXHR, textStatus, errorThrown);
}

blir.discord.ajax.statusHandler['429'] = function(errorFn, ajaxArgs, jqXHR, textStatus, errorThrown) {
	// TOO MANY REQUESTS
	console.error('TOO MANY REQUESTS');
	blir.discord.ajax.canSend = false;
	var retryAfter = parseInt(jqXHR.getResponseHeader('Retry-After'));
	blir.discord.ajax.ajax.apply(this, ajaxArgs);
	setTimeout(function() {
		blir.discord.ajax.canSend = true;
	}, retryAfter);
}

blir.discord.ajax.statusHandler['502'] = function(errorFn, ajaxArgs, jqXHR, textStatus, errorThrown) {
	// BAD GATEWAY
	console.log('BAD GATEWAY');
	blir.discord.ajax.ajax.apply(this, ajaxArgs);
}

blir.discord.setToken = function(token) {
	blir.discord.ajax.token = token;
}

blir.discord.sendChat = function(channelId, chat) {
	blir.discord.ajax.ajax( 'channels/' + channelId + '/messages', {
		method: 'POST',
		data: {
			content: chat
		}
	});
}