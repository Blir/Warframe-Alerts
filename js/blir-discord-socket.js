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

blir.discord.socket.setSocket = function(websocket) {
	blir.discord.socket.websocket = websocket;
}

blir.discord.socket.send = function(data) {
	blir.discord.socket.websocket.send(JSON.stringify(data));
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
	blir.discord.socket.gateway = resp.gateway;
	var websocket = new WebSocket(resp.url);
	websocket.onopen = blir.discord.socket.onWebSocketOpen;
	websocket.onmessage = blir.discord.socket.onmessage;
	websocket.onclose = function() {
		console.log('websocket closed');
		clearInterval(blir.discord.socket.heartbeatInterval.interval);
		setTimeout(blir.discord.socket.onGetGatewaySuccess.bind(this, resp), 5000);
		blir.discord.socket.onclose();
	}
	websocket.onerror = function() {
		console.log('websocket error');
	};
	blir.discord.socket.setSocket(websocket);
}

blir.discord.socket.onWebSocketOpen = function() {
	blir.discord.socket.send({
		op: 2,
		d: {
			token: blir.discord.ajax.token,
			v: 3,
			properties: {
				$os: 'Windows',
				$browser: 'blir',
				$device: 'blir',
				$referrer: '',
				$referring_domain: ''
			},
			large_threshold: 100
		}
	});
}

blir.discord.socket.onWebSocketMessage = function(message) {
	var data = JSON.parse(message.data);
	var dataPanel = blir.discord.socket.dataPanel;
	if (dataPanel) {
		dataPanel.addDatum(data.t, data);
	} else {
		console.log('Message received: ' + data.t);
	}
	var handler = blir.discord.socket.messageHandler[data.t];
	if (handler) {
		handler(data);
	}
}

blir.discord.socket.messageHandler['READY'] = function(data) {
	blir.discord.socket.heartbeatInterval.sleep = data.d.heartbeat_interval;
	console.log('heartbeat interval is ' + data.d.heartbeat_interval);
	blir.discord.socket.heartbeatInterval.interval = setInterval(blir.discord.socket.keepAlive, data.d.heartbeat_interval);
	blir.discord.socket.onready();
}

blir.discord.socket.keepAlive = function() {
	console.log('Sending heartbeat...');
	blir.discord.socket.send({
		op: 1,
		d: (new Date()).getTime().toString()
	});
}