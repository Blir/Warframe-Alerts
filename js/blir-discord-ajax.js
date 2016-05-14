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

blir.discord.ajax.init = function() {
	setInterval(blir.discord.ajax.processQueue, 250);
}

blir.discord.ajax.initDataPanel = function(elem, maxSize) {
	blir.discord.ajax.dataPanel = blir.util.createDataPanel(elem, maxSize);
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
	var dataPanel = blir.discord.ajax.dataPanel;
	if (dataPanel) {
		dataPanel.addDatum(url, options);
	} else if(!options.silent) {
		console.log('processing ' + url);
	}
	var token = blir.discord.ajax.token;
	if (token) {
		options.headers = options.headers || {};
		options.headers.Authorization = token;
	}
	var errorFn = options.error || function() {
		console.error('error on request ' + url);
	};
	options.error = blir.discord.ajax.error.bind(this, errorFn, arguments);
	$.ajax('https://discordapp.com/api/' + url, options);
}

blir.discord.ajax.error = function(errorFn, ajaxArgs, jqXHR, textStatus, errorThrown) {
	var statusHandler = blir.discord.ajax.statusHandler[jqXHR.status];
	if (statusHandler) {
		statusHandler.apply(this, arguments);
	}
	errorFn();
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