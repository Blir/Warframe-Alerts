// DEPENDENCIES: jQuery

window.blir = window.blir || {};
blir.util = blir.util || {};

blir.util.version = '1.0';
blir.util.author = 'Blir';

blir.util.toggleVisibilityOnClick = function(clickElem, hiddenElem) {
	clickElem.on('click', function() {
		var isHidden = hiddenElem.attr('hidden') == 'hidden';
		hiddenElem[isHidden ? 'removeAttr' : 'attr']('hidden', 'hidden');
	});
}

blir.util.createDataPanel = function(rootElem, maxSize) {	
	return {
		data: [],
		addDatum: function(datumDisplay, datum) {
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
			var wrapper = $('<div></div>');
			var datumDisplayPanel = $('<div class="datumPanelDisplay"></div>');
			wrapper.append(datumDisplayPanel);
			var datumPanel = $('<div class="datumPanel" hidden></div>');
			var type = typeof datum;
			datumDisplayPanel.attr('type', type);
			if (type == 'object') {
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
			elem.append(wrapper);
		}
	};
}

blir.util.createRadioButtons = function(elem, name, choices, contentProp, valueProp, options) {
	options = options || {};
	var filter = options.filter;
	var listener = options.listener;
	var input = '<input type="radio" name="{name}" value="{value}" id="{value}">';
	input = input.replace(/{name}/g, name);
	var label = '<label for="{value}">{content}</label>';
	elem.find('input, label').remove();
	for (var i in choices) {
		var choice = choices[i];
		var content = choice[contentProp];
		var value = choice[valueProp];
		if (!filter || filter(choice)) {
			elem.append($(input.replace(/{value}/g, value)));
			elem.append($(label.replace(/{value}/g, value).replace(/{content}/g, content)));
		}
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
			arg = splitArg.substring(1);
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