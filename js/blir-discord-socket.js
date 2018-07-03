// DEPENDENCIES: blir-discord-ajax

window.blir = window.blir || {};
blir.discord = blir.discord || {};
blir.discord.socket = blir.discord.socket || {};
blir.discord.socket.heartbeatInterval = blir.discord.socket.heartbeatInterval || {};

blir.discord.socket.messageHandler = {};

blir.discord.socket.version = '1.0';
blir.discord.socket.author = 'Blir';

blir.discord.socket.initDataPanel = function(elem, maxSize) {
	blir.discord.socket.dataPanel = blir.util.createDataPanel(elem, maxSize);
}

blir.discord.socket.initEventDataPanel = function(elem, maxSize, logLevel) {
	blir.discord.socket.eventDataPanel = blir.util.createDataPanel(elem, maxSize, logLevel, true);
}

blir.discord.socket.logEvent = function(logLevel, msg, event) {
	var dataPanel = blir.discord.socket.eventDataPanel;
	if (dataPanel) {
		dataPanel.logDatum(logLevel, msg, event);
	} else {
		console.log(msg);
	}
}

blir.discord.socket.setSocket = function(websocket) {
	blir.discord.socket.websocket = websocket;
}

blir.discord.socket.send = function(data) {
	blir.discord.socket.websocket.send(JSON.stringify(data));
}

blir.discord.socket.sendNS = function(data) {
	blir.discord.socket.websocket.send(data);
}

blir.discord.socket.connectWebsocket = function(onclose, onready) {
	blir.discord.socket.onmessage = blir.discord.socket.onWebSocketMessage;
	blir.discord.socket.onclose = onclose;
	blir.discord.socket.onready = onready;
	blir.discord.ajax.ajax('gateway', {
		method: 'GET',
		success: blir.discord.socket.onGetGatewaySuccess
	});
}

blir.discord.socket.onGetGatewaySuccess = function(resp) {
	var gateway = resp.url + '/?v=6&encoding=json';
	var websocket = new WebSocket(gateway);
	websocket.onopen = blir.discord.socket.onWebSocketOpen;
	websocket.onmessage = blir.discord.socket.onmessage;
	websocket.onclose = function(closeEvent) {
		blir.discord.socket.logEvent('WARNING', 'Websocket closed', {
			code: closeEvent.code,
			reason: closeEvent.reason
		});
		clearInterval(blir.discord.socket.heartbeatInterval.interval);
		if (blir.discord.socket.timeout < 600) {
			blir.discord.socket.timeout += 10;
		}
		var timeout = blir.discord.socket.timeout;
		setTimeout(blir.discord.socket.onGetGatewaySuccess.bind(this, resp), timeout * 1000);
		blir.discord.socket.onclose(closeEvent, timeout);
	}
	websocket.onerror = function() {
		blir.discord.socket.logEvent('SEVERE', 'Websocket error', arguments);
	};
	blir.discord.socket.setSocket(websocket);
}

blir.discord.socket.onWebSocketOpen = function() {
}

blir.discord.socket.identify = function(gameName) {
	blir.discord.socket.send({
		op: 2,
		d: {
			token: blir.discord.ajax.token,
			v: 6,
			properties: {
				$os: 'Windows 10',
				$browser: 'blir',
				$device: 'blir'
			},
			large_threshold: 50//,
			//shard: [1, 0],
			//presence: blir.discord.socket.presenceObj(gameName)
		}//,
		//s: blir.discord.socket.seq || null
	});
}

blir.discord.socket.presenceObj = function(gameName) {
	return {
		game: {
			name: gameName,
			type: 3
			// 0	Game
			// 1	Streaming
			// 2	Listening
			// 3	Watching
		},
		status: 'online',
		//online dnd idle invisible offline
		since: null,
		afk: false
	};
}

blir.discord.socket.statusUpdate = function(gameName) {
	// TODO rate limit & only send when able (connected and auth'd)
	blir.discord.socket.send({
		op: 3,
		d:  blir.discord.socket.presenceObj(gameName)
	});
}

blir.discord.socket.onWebSocketMessage = function(message) {
	var data = JSON.parse(message.data);
	var msgs = {
		'10': 'HELLO',
		'11': 'ACK'
	};
	var msg = data.t || msgs[data.op];
	var dataPanel = blir.discord.socket.dataPanel;
	if (dataPanel) {
		dataPanel.addDatum(msg, data);
	} else {
		//console.log('Message received: ' + data.t);
	}
	if (data.s) {
		blir.discord.socket.seq = data.s;
	}
	var handler = blir.discord.socket.messageHandler[msg];
	if (handler) {
		handler(data);
	} else {
		//console.warn('No handler for op ' + data.op + ': ' + msg);
	}
}

blir.discord.socket.messageHandler['READY'] = function(data) {
	blir.discord.socket.timeout = 5;
	blir.discord.socket.onready();
}

blir.discord.socket.messageHandler['HELLO'] = function(data) {
	var interval = data.d.heartbeat_interval;
	blir.discord.socket.heartbeatInterval.sleep = interval;
	blir.discord.socket.logEvent('INFO', 'Heartbeat interval is ' + interval, '');
	if (typeof interval == 'number') {
		blir.discord.socket.heartbeatInterval.interval = setInterval(blir.discord.socket.keepAlive, interval);
	} else {
		console.error('Heartbeat interval is missing');
		blir.discord.socket.heartbeatInterval.interval = null;
	}

	// TODO handle resumed or invalid session
	// and check for ACKs between heartbeats

	blir.discord.socket.identify();
}

blir.discord.socket.messageHandler['ACK'] = function(data) {
	//blir.discord.socket.logEvent('FINE', 'We got an ACK!', '');
	blir.discord.socket.ack = true;
}

blir.discord.socket.keepAlive = function() {
	if (!blir.discord.socket.ack) {
		console.warn('Didn\'t get an ACK! :(');
	} else {
		blir.discord.socket.ack = false;
	}
	var seq = blir.discord.socket.seq || null;
	var heartbeatObj = {
		op: 1,
		d: seq
	};
	blir.discord.socket.logEvent('INFO', 'Sending heartbeat', heartbeatObj);
	blir.discord.socket.send(heartbeatObj);
}