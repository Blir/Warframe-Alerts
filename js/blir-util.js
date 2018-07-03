// DEPENDENCIES: jQuery

window.blir = window.blir || {};
blir.util = blir.util || {};

blir.util.version = '1.0';
blir.util.author = 'Blir';

blir.util.init = function(jQuery) {
	blir.util.jQuery = jQuery || $;
}

blir.util.toggleVisibilityOnClick = function(clickElem, hiddenElem) {
	clickElem.on('click', function() {
		var isHidden = hiddenElem.attr('hidden') == 'hidden';
		hiddenElem[isHidden ? 'removeAttr' : 'attr']('hidden', 'hidden');
	});
}

blir.util.createDataPanel = function(rootElem, maxSize, myLogLevel, useTimestamps) {
	var logLevels = {
		'FINEST': 0,
		'FINER': 1,
		'FINE': 2,
		'INFO': 3,
		'WARNING': 4,
		'SEVERE': 5
	};
	return {
		data: [],
		addDatum: function(datumDisplay, datum) {
			this.logDatum(null, datumDisplay, datum);
		},
		logDatum: function(logLevel, datumDisplay, datum) {
			if (myLogLevel && logLevels[logLevel] < logLevels[myLogLevel]) {
				return;
			}
			if (useTimestamps) {
				datumDisplay = blir.util.getTimestamp() + ': ' + datumDisplay;
			}
			if (this.data.length == maxSize) {
				this.removeFirstDatum();
			}
			this.data.push(datum);
			this.createDatumPanel(rootElem, datumDisplay, datum);
		},
		removeFirstDatum: function() {
			var datumPanel = rootElem.find('.datumPanelDisplay').first();
			if (datumPanel.attr('type') == 'object') {
				rootElem.find('.datumPanel').first().remove();
			}
			datumPanel.remove();
			this.data.shift();
		},
		createDatumPanel: function(elem, datumDisplay, datum) {
			var wrapper = blir.util.jQuery('<div></div>');
			var datumDisplayPanel = blir.util.jQuery('<div class="datumPanelDisplay"></div>');
			wrapper.append(datumDisplayPanel);
			if (datum) {
				var type = typeof datum;
				datumDisplayPanel.attr('type', type);
				if (type == 'object') {
					var datumPanel = blir.util.jQuery('<div class="datumPanel" hidden></div>');
					wrapper.append(datumPanel);
					datumDisplayPanel.text(datumDisplay);
					for (var prop in datum) {
						if (datum.hasOwnProperty(prop)) {
							this.createDatumPanel(datumPanel, prop, datum[prop]);
						}
					}
					blir.util.toggleVisibilityOnClick(datumDisplayPanel, datumPanel);
				} else {
					datumDisplayPanel.text(datumDisplay + ': ' + (type == 'function' ? 'function' : datum));
				}
			} else {
				datumDisplayPanel.text(datumDisplay);
			}
			elem.append(wrapper);
		}
	};
}

blir.util.createRadioButtons = function(elem, name, choices, contentProp, valueProp, options) {
	options = options || {};
	var filter = options.filter;
	var listener = options.listener;
	elem.find('input, label').remove();
	for (var i in choices) {
		var choice = choices[i];
		var content = choice[contentProp];
		var value = choice[valueProp];
		var div = blir.util.jQuery('<div/>');
		if (!filter || filter(choice)) {
			div.append(blir.util.jQuery(`<input type="radio" name="${name}" value="${value}" id="${value}">`));
			div.append(blir.util.jQuery(`<label for="${value}">${content}</label>`));
		}
		elem.append(div);
	}
	if (listener) {
		elem.find('input, label').on('change', listener);
	}
}

blir.util.parseArgs = function(strArgs) {
	if (!strArgs) {
		return [];
	}
	var splitArgs = strArgs.split(' ');
	var args = [];
	var arg;
	for (var i in splitArgs) {
		var splitArg = splitArgs[i];
		if (splitArg.startsWith('"')) {
			if (splitArg.endsWith('"')) {
				args.push(splitArg.substring(1, splitArg.length - 1));
			} else {
				arg = splitArg.substring(1);
			}
		} else if (arg && splitArg.endsWith('"')) {
			arg += ' ' + splitArg.substring(0, splitArg.length - 1);
			args.push(arg);
			arg = '';
		} else if (arg) {
			arg += ' ' + splitArg;
		} else {
			args.push(splitArg);
		}
	}
	return args;
}

blir.util.getTimestamp = function() {
	
	function pad(num, len) {
		len = len || 2;
		var dif = len - num.toString().length;
		if (dif == 1) {
			return '0' + num;
		}
		if (dif == 2) {
			return '00' + num;
		}
		return num;
	}
	
	var now = new Date();
	var month = now.getMonth() + 1;
	var day = now.getDate();
	var hours = now.getHours();
	var minutes = now.getMinutes();
	var seconds = now.getSeconds();
	var millis = now.getMilliseconds();
	var ampm = hours < 12 ? ' AM' : ' PM';
	if (hours == 0) {
		hours = 12;
	} else if (hours > 12) {
		hours -= 12;
	}
	month = pad(month);
	day = pad(day);
	hours = pad(hours);
	minutes = pad(minutes);
	seconds = pad(seconds);
	millis = pad(millis, 3);
	return month + '/' + day + ' ' + hours + ':' + minutes + ':' + seconds + '.' + millis + ampm;
}