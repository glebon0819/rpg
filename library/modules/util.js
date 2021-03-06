const fs = require('fs');
const chalk = require('chalk');
const readlineSync = require('readline-sync');

var config = {};
var commands = {};

exports.setConfig = function(data){
	config = data;
}

exports.setCommands = function(data){
	commands = data;
}

exports.getTimestamp = function(readable){

	var now = new Date();
	var dd = now.getDate();
	var mm = now.getMonth()+1;
	var yyyy = now.getFullYear();
	var hh = now.getHours();
	var mm2 = now.getMinutes();
	var ss = now.getSeconds();
	var mmm = now.getMilliseconds();

	if(dd < 10) {
	    dd = '0' + dd;
	} 
	if(mm < 10) {
	    mm = '0' + mm;
	}
	if(hh < 10) {
	    hh = '0' + hh;
	}
	if(mm2 < 10) {
	    mm2 = '0' + mm2;
	}
	if(ss < 10) {
	    ss = '0' + ss;
	}
	if(mmm < 10){
		mmm = '00' + mmm;
	}
	else if(mmm < 100){
		mmm = '0' + mmm;
	}

	if(readable){
		timestamp = (yyyy + '-' + mm + '-' + dd + 'T' + hh + ':' + mm2 + ':' + ss + '.' + mmm + 'Z');
	}
	else{
		timestamp = (dd + mm + yyyy + hh + mm2 + ss + mmm);
	}
	return timestamp;

}

// logs strings to the console while maintaining the predefined character width of the game
exports.echo = function(string, preserve, pad, padding){
	string = string.trim();
	var width = config.GAME_CHAR_WIDTH;
	var lastI = 0;
	var end;
	var done = false;
	var lastCharI = string.length - 1;
	if(padding === undefined){
		var padding = '   ';
	}
	if(preserve !== true) {
		while(done == false) {
			var endFound = false;
			var char;
			end = lastI + (width - padding.length);
			while(!endFound){
				if(end === lastI){
					endFound = true;
					end = lastI + (width - padding.length);
				}
				else{
					char = string.charAt(end);
					if(char === ' ' || end === string.length){
						endFound = true;
					}
					else{
						end--;
					}
				}
			}
			if(pad !== undefined && pad === true) {
				console.log();
				console.log(padding + string.substring(lastI, end).trim());
				console.log();
			}
			else {
				console.log(padding + string.substring(lastI, end).trim());
			}
			lastI = end;
			if(lastI >= lastCharI) {
				done = true;
			}
		}
	}
	else {
		for(var i = 0; i < Math.ceil(string.length / ((width + 1) - padding.length)); i++){
			end = lastI + width;
			if(end > (string.length)) {
				end = (string.length);
			}
			if(pad !== undefined && pad === true) {
				console.log();
				console.log(padding + (string.substring(lastI, end).replace(/~/g, chalk.cyan('~')).replace(/Y/g, chalk.green('Y')).replace(/\^/g, chalk.gray('^'))));
				console.log();
			}
			else {
				console.log(padding + (string.substring(lastI, end).replace(/~/g, chalk.cyan('~')).replace(/Y/g, chalk.green('Y')).replace(/\^/g, chalk.gray('^'))));
			}
			lastI += width;
		}
	}
}

// returns the key to a random property of an input object where the values are the properties' probabilities of being picked
exports.randPick = function(object){

	var num = Math.random(),
        s = 0,
        res = null,
        found = false;

    Object.keys(object).forEach(function(element){
        s += parseFloat(object[element]);
        if (num < s && !found) {
        	res = element;
            found = true;
        }
    });

	return res;
}

exports.roll = function() {
	return this.randNum(20);
}

// generates a random number within a certain range
exports.randNum = function(ceiling, floor) {
	if(!floor) {
		floor = 0;
	}
	return Math.floor((Math.random() * ceiling) + floor);
}

// generates a random float within a certain range
exports.randFloat = function(ceiling, floor) {
	if(!floor) {
		floor = 0;
	}
	return ((Math.random() * ceiling) + floor).toFixed(2);
}

// prints contents of a text file to the console
exports.render = function(path){

	var contents = fs.readFileSync(path, 'utf8');

	console.log();
	module.exports.echo(contents.replace(/\r?\n|\r/g, ""), true, ' ');
	console.log();

}

// prints a map file to the console, automatically colors characters
exports.renderMap = function(path){

	var contents = fs.readFileSync(path, 'utf8');
	var key = fs.readFileSync('./library/resources/maps/key.txt', 'utf8');

	//contents = contents.replace(/~/g, chalk.blue('~'));

	console.log();
	module.exports.echo(contents.replace(/\r?\n|\r/g, ""), true, ' ');
	console.log();
	module.exports.echo(key.replace(/\r?\n|\r/g, ""), true, ' ');
	console.log();
}

// logs text to log file
exports.log = function(text){
	try {
		var logFileContents = fs.readFileSync('log.txt');
		fs.writeFileSync('log.txt', logFileContents + text);
	}
	catch(error) {
		fs.writeFileSync('log.txt', text);
	}
}

// creates a spacer that spans the game's console width using the given char
exports.generateSpacer = function(char){
	var spacer = '';
	if(char.length > 1) {
		char = char[0];
	}
	for(var i = 0; i < config.GAME_CHAR_WIDTH; i++) {
		spacer += char;
	}
	return spacer;
}


exports.getCmdGrp = function(cmd){
	var grp = null;
	grp = commands[cmd].grp;
	return grp;
}

// echoes options for the user to choose from; based off readline-sync's
exports.keyInSelect = function(options, msg) {
	/*if(msg === undefined || msg === null) {
		msg = '';
	}*/
	var indices;
	msg = ' ' + msg + ' ';
	options.forEach(function(option, idx) {
		module.exports.echo(`[${idx + 1}]  "${option}"`);
		indices += (idx + 1).toString();
	});
	console.log();
	var index = readlineSync.keyIn(msg, {
    	hideEchoBack: false, mask: '', limit: indices
	});
	return index;
}