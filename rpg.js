const readline = require('readline');
const fs = require('fs');

var userData = {cooldowns : {}};
var items = {};
var monsters = {};
var modes = {};

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var sessionData = {
	// keeps track of how many lines the user has entered
	'cycle' : 0,
	// keeps track of the last actual command to be entered
	'lastCmd' : '',
	// tracks the number of lines entered since the last command
	'linesSince' : 0,
	'mode' : 'start'
};

function getTimestamp(readable){
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
		timestamp = (dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mm2 + ':' + ss);
	}
	else{
		timestamp = (dd + mm + yyyy + hh + mm2 + ss + mmm);
	}
	return timestamp;
}

// function that loads the library files
function loadResources(){
	var encyclopedia = fs.readFileSync('./library/encyclopedia.json', 'utf8');
	items = JSON.parse(encyclopedia);
	var bestiary = fs.readFileSync('./library/bestiary.json', 'utf8');
	monsters = JSON.parse(bestiary);
	var gamemodes = fs.readFileSync('./library/modes.json', 'utf8');
	modes = JSON.parse(gamemodes);
}

// function for retrieving saves from the save folder
function getSaves(){
	var saves = [];
	var files = fs.readdirSync('saves');
	files.forEach(file => {
		//console.log(file);
		var json = fs.readFileSync('./saves/' + file, 'utf8');
		var data = JSON.parse(json);
		var name = data.gen.nam;
		saves.push({file : file, name : data.gen.nam, date : data.gen.dat});
	});
	return saves;
}

// function that adds an item to player inventory
function addToInv(itm, num, qty, typ){
	// get inventory items
	var inv = Object.keys(userData.inv);
	var match = false;
	// if item is in inventory increment qty, if not, add item
	inv.forEach(item => {
		if(itm == item){
			match = true;
		}
	});

	if(match){
		userData.inv[itm].qty = userData.inv[itm].qty + qty;
	}else{
		userData.inv[itm] = {typ: typ, og : num, qty : qty};
	}

	// print to screen message notifying player that an item was added to their inventory
	console.log(`\n   ${qty} x '${itm}' added to inventory.\n`);
}

// function that removes an item from player inventory
function remFromInv(itm, qty){
	// get inventory items
	var inv = Object.keys(userData.inv);
	var match = false;
	// if item is in inventory decrement qty, if not, remove item
	inv.forEach(item => {
		if(itm == item){
			match = true;
		}
	});

	if(match){
		userData.inv[itm].qty = userData.inv[itm].qty - qty;
		if(userData.inv[itm].qty <= 0){
			delete userData.inv[itm];
		}
		return true;
	}else{
		return false;
	}
}

// checks if a command exists, returns false if not
function cmdExists(cmd){
	var exists = false;
	var commands = Object.keys(commandMap);
	commands.forEach(command => {
		if(command == cmd){
			exists = true;
		}
	});
	return exists;
}

// checks if a command is allowed under the current mode
function checkMode(cmd){
	var allowed = false;
	// if whitelist is defined, use that. else, use blacklist
	if(Object.keys(modes[sessionData.mode].white).length > 0){
		for(var commandKey in modes[sessionData.mode].white){
			if(modes[sessionData.mode].white[commandKey] == cmd){
				allowed = true;
			}
		}
	}
	else{
		allowed = true;
		for(var commandKey in modes[sessionData.mode].black){
			if(modes[sessionData.mode].black[commandKey] == cmd){
				allowed = false;
			}
		}
	}
	return allowed;
}

function createCooldown(cmd, sec){
	// converts seconds to milliseconds
	var dur = sec * 1000;
	// add a cooldown to the userData
	userData.cooldowns[cmd] = {beg : getTimestamp(false), dur : sec};
	// create a timer to lift the cooldown
	setTimeout(removeCooldown, dur, cmd);
}

function removeCooldown(cmd){
	delete userData.cooldowns[cmd];
	//console.log(`   '${cmd}' can now be used again.\n`);
}

// function that checks if a cooldown is currently in effect
// returns time left in seconds if there is active cooldown, false if not
function checkCooldown(cmd){
	var timeleft = false;
	Object.keys(userData.cooldowns).forEach(command => {
		if(command == cmd){
			timeleft = userData.cooldowns[command].dur - Math.floor((getTimestamp(false) - userData.cooldowns[command].beg) / 1000);
		}
	});

	return timeleft;
}

// cleans up cooldowns, buffs, etc. that are left over from the last session
// removes expired things and sets timeouts for things that are still active
function cleanUp(){
	for(var command in userData.cooldowns){
		var timeleft = userData.cooldowns[command].dur - Math.floor((getTimestamp(false) - userData.cooldowns[command].beg) / 1000);
		if(timeleft > 0){
			setTimeout(removeCooldown, timeleft * 1000, command);
		}
		else{
			delete userData.cooldowns[command];
		}
	}
}

// returns whether a string is a stat
function isStat(str){
	var isStat = false;
	Object.keys(userData.stats).forEach(stat => {
		if(stat == str){
			isStat = true;
		}
	});
	return isStat;
}

// returns whether an item is in the player's inventory
function isInInv(itm){
	var isInInv = false;
	Object.keys(userData.inv).forEach(item => {
		if(item == itm){
			isInInv = true;
		}
	});
	return isInInv;
}

// removes item from inventory and applies its buffs and effects
function consume(itm){
	// get id of item from inventory and use it to access item's description in encyclopedia
	var id = userData.inv[itm].og;

	var effects = items[id].effects;
	for(var effect in effects){
		if(effect == 'hp'){
			changeHP(effects[effect]);
		}
		else if(effect == 'ap'){
			changeAP(effects[effect]);
		}
	}

	remFromInv(itm, 1);
}

function changeAP(val){
	userData.gen.ap += val;
	if(userData.gen.ap > userData.gen.apm){
		userData.gen.ap = userData.gen.apm;
		//clearInterval(replenish);
	}
	else if(userData.gen.ap < 0){
		userData.gen.ap = 0;
	}

	// if ap is less than max, replenish it
	/*if(userData.gen.ap < userData.gen.apm && typeof replenish == undefined){
		// effected by user's resilience stat
		var replenish = setInterval(changeAP(1), 1000);
	}*/

	console.log(`   ${(val > 0 ? '+' : '-')}  AP: (${userData.gen.ap}/${userData.gen.apm}).\n`);
}

function changeHP(val){
	userData.gen.hp += val;
	if(userData.gen.hp > userData.gen.hpm){
		userData.gen.hp = userData.gen.hpm;
		//clearInterval(replenish);
	}
	else if(userData.gen.hp < 0){
		userData.gen.hp = 0;
	}

	// if ap is less than max, replenish it
	/*if(userData.gen.ap < userData.gen.apm && typeof replenish == undefined){
		// effected by user's resilience stat
		var replenish = setInterval(changeAP(1), 1000);
	}*/

	console.log(`   ${(val > 0 ? '+' : '-')}  HP: (${userData.gen.hp}/${userData.gen.hpm}).\n`);
}

// maps commands to functions and includes data about commands
var commandMap = {
	// creates a new game profile
	'new' : {
		// what command group it belongs to
		'grp' : 'Profile',
		// expected number of additional inputs
		'expIn' : 1,
		// messages to give before the extra inputs
		'mess' : {
			0 : '\n   What\'s your name?\n'
		},
		'func' : function(cmd){
			cmd.shift();
			var username = cmd.join(' ');

			if(username.length > 0){

				var profiles = getSaves();
				var available = true;
				profiles.forEach(profile => {
					if(profile.name == username){
						available = false;
					}
				});

				if(available){
					userData = {
						gen: {
							nam : username,
							dat : getTimestamp(true),
							dt2 : getTimestamp(false),
							lvl : 1,
							hp : 100,
							hpm : 100,
							ap : 100,
							apm : 100,
							exp : 0,
							gld : 5,
							slv : 50,
							kll : 0,
							dth : 0,
							poi : 5
						},
						inv: {
							'Health Potion' : {
								og : 1,
								qty : 1
							},
							'Poison' : {
								og : 5,
								qty : 1
							},
							'Water' : {
								og : 12,
								qty : 2
							}
						},
						stats: {
							strength : 0,
							stamina : 0,
							resilience : 0,
							intellect : 0,
							luck : 0,
							agility : 0
						},
						cooldowns: {}
					};

					//userData.gen.nam = username;
					sessionData.mode = 'general';
					console.log(`\n   Welcome, ${userData.gen.nam}!\n   Your profile was created at ${userData.gen.dat}.\n`);

				}
				else{
					console.log('\n   That username is unavailable.\n')
				}
			}
			else {
				console.log('\n  No username provided.\n');
			}
		}
	},
	'profiles' : {
		'grp' : 'Profile',
		'func' : function(cmd){
			var profiles = getSaves();
			if(profiles.length == 0){
				console.log('\n   No save files were found.\n')
			}
			else {
				console.log('\n   We found the following save files on your disc:');
				profiles.forEach(profile => {
					console.log(`\n   +  Created on ${profile.date} ........ "${profile.name}"`);
				});
				console.log('');
			}
		}
	},
	// loads user data from a save file
	'load' : {
		'grp' : 'Profile',
		'func' : function(cmd){
			cmd.shift();
			var profileName = cmd.join(' ');
			var filename = '';

			// make sure user entered a profile name
			if(profileName.length > 0){
				// check if profile exists
				var profiles = getSaves();
				profiles.forEach(profile => {
					if(profile.name == profileName){
						filename = profile.file;
					}
				});

				// if profile exists, load it
				if(filename.length > 0){
					var json = fs.readFileSync('./saves/' + filename, 'utf8');
					var data = JSON.parse(json);
					userData = data;
					sessionData.mode = 'general';
					
					// clean up cooldowns, buffs, etc. left over from last session
					cleanUp();

					console.log(`\n   Welcome back, ${userData.gen.nam}!\n`)
				}
				else{
					console.log(`\n   Could not locate profile "${profileName}".\n`);
				}
			}
			else{
				console.log('\n   Load failed. No profile name provided.\n');
			}
		}
	},
	// deletes a save profile
	'delete' : {
		'grp' : 'Profile',
		'func' : function(cmd){
			cmd.shift();
			var profileName = cmd.join(' ');
			var filename = '';

			// make sure user entered a profile name
			if(profileName.length > 0){
				// check if profile exists
				var profiles = getSaves();
				profiles.forEach(profile => {
					if(profile.name == profileName){
						filename = profile.file;
					}
				});

				if(filename.length > 0){
					fs.unlink('./saves/' + filename, (err) => {
						if (err) throw err;
						console.log(`\n   ${profileName} was deleted.\n`);
					});
				}
				else{
					console.log(`\n   Could not locate profile "${profileName}".\n`);
				}
			}
			else{
				console.log('\n   Delete failed. No profile name provided.\n');
			}
		}
	},
	// barfs out a list of all of the commands
	'commands' : {
		'grp' : 'Miscellaneous',
		'func' : function(cmd){
			console.log(`\n   Commands\n ========================================================\n`);
			var cmds = Object.keys(commandMap);
			cmds.forEach(cmd => {
				console.log(`   ${cmd}\n`);
			});
		}
	},
	// shows the user a list of the items in their inventory
	'inv' : {
		'grp' : 'Inventory',
		'func' : function(cmd){
			if(Object.keys(userData.inv).length > 0){
				console.log(`\n ========================================================\n   ${userData.gen.nam}'s Inventory\n --------------------------------------------------------\n`)
				var items = Object.keys(userData.inv);
				items.forEach(item => {
					console.log('   ' + userData.inv[item].qty + ` x ${item}\n`);
				});
				console.log(' ========================================================\n');
			}
			else{
				console.log('\n   Your inventory is empty.\n');
			}
		}
	},
	// shows the user a list of the items in their inventory
	'inventory' : {
		'grp' : 'Inventory',
		'func' : function(cmd){
			commandMap['inv'].func(cmd);
		}
	},
	// drops an item from inventory
	'drop' : {
		'grp' : 'Inventory',
		'func' : function(cmd){
			cmd.shift();
			var item = cmd.join(' ');
			if(item.length > 0){
				if(remFromInv(item, 1)){
					console.log(`\n   '${item}' dropped from inventory.\n`);
				}
				else{
					console.log(`\n   Failed to drop '${item}' from inventory. No such item found.\n`);
				}
			}
			else{
				console.log(`\n   No item specified to drop.\n`);
			}
		}
	},
	// shows the user what stats they have
	'stats' : {
		'grp' : 'Stats',
		'func' : function(cmd){
			var stats = Object.keys(userData.stats);
			console.log(`\n   ${userData.gen.nam}'s Stats:\n`);
			stats.forEach(stat => {
				console.log(`   + ${stat}: ${userData.stats[stat]}`);
			});
			console.log();
		}
	},
	// used to assign points to different stats
	'assign' : {
		'grp' : 'Stats',
		'func' : function(cmd){
			cmd.shift();
			if(Object.keys(cmd).length === 2){
				if(isStat(cmd[Object.keys(cmd)[0]])){
					if(parseInt(cmd[Object.keys(cmd)[1]]) > 0){
						if(userData.gen.poi >= parseInt(cmd[Object.keys(cmd)[1]])){
							userData.stats[cmd[Object.keys(cmd)[0]]] += parseInt(cmd[Object.keys(cmd)[1]]);
							userData.gen.poi -= parseInt(cmd[Object.keys(cmd)[1]]);
							console.log(`\n   '${cmd[Object.keys(cmd)[0]]}' changed to ${userData.stats[cmd[Object.keys(cmd)[0]]]}.\n`);
						}
						else{
							console.log('\n   Insufficient unassigned stat points.\n');
						}
					}
					else{
						console.log('\n   Use a number.\n');
					}
				}
				else{
					console.log('\n   That is not a stat.\n');
				}
			}
			else{
				console.log('\n   Arguments improperly given. Give a stat followed by the number of points you would like to assign to that stat.\n');
			}
		}
	},
	// shows the user general information about themself
	'me' : {
		'grp' : 'Miscellaneous',
		'func' : function(cmd){

		}
	},
	// can be used to consume beverages and potions
	'drink' : {
		'grp' : 'Inventory',
		'func' : function(cmd){
			cmd.shift();
			var itm = cmd.join(' ');

			// check if item is defined
			if(itm.length > 0){
				// check if is in inventory
				if(isInInv(itm)){
					// check if is food
					if(items[userData.inv[itm].og].typ == 'potion' || items[userData.inv[itm].og].typ == 'beverage'){
						// consume (which removes it from inventory and applies the buff/effect)
						console.log(`\n   You drink ${itm}.\n`);
						consume(itm);
					}
					else{
						console.log('\n   You cannot drink that item.\n');
					}
				}
				else{
					console.log(`\n   '${itm}' not found in your inventory.\n`);
				}
				//console.log('\n   You eat an apple. HP: (100/100)\n');
			}
			else{
				console.log('\n   No item provided to drink.\n');
			}
		}
	},
	// can be used to consume food items
	'eat' : {
		'grp' : 'Inventory',
		'func' : function(cmd){
			cmd.shift();
			var itm = cmd.join(' ');

			// check if item is defined
			if(itm.length > 0){
				// check if is in inventory
				if(isInInv(itm)){
					// check if is food
					if(userData.inv[itm].typ == 'food'){
						// consume (which removes it from inventory and applies the buff/effect)
						consume(itm);
						console.log(`\n   You ate ${itm}.\n`);
					}
					else{
						console.log('\n   You cannot eat that item.\n');
					}
				}
				else{
					console.log(`\n   '${itm}' not found in your inventory.\n`);
				}
				//console.log('\n   You eat an apple. HP: (100/100)\n');
			}
			else{
				console.log('\n   No item provided to eat.\n');
			}
		}
	},
	// continues your latest battle
	'adv' : {
		'grp' : 'Miscellaneous',
		'func' : function(cmd){
			console.log('\n   You\'re now on an adventure.\n');
		}
	},
	// forages in the local area, adding berries to your inventory
	'forage' : {
		'grp' : 'Gathering',
		'func' : function(cmd){

			addToInv('Berries', 6, 2, 'food');

			// create cooldown
			createCooldown('forage', 20);
		}
	},
	// fishes in the local area, adding fish to your inventory
	'fish' : {
		'grp' : 'Gathering',
		'func' : function(cmd){

			addToInv('Fish', 3, 1, 'food');

			// create cooldown
			createCooldown('fish', 30);
		}
	},
	// chops down in the local area, adding logs to your inventory
	'chop' : {
		'grp' : 'Gathering',
		'func' : function(cmd){

			addToInv('Log', 2, 1);
			changeAP(-20);

			// create cooldown
			createCooldown('chop', 30);
		}
	},
	// mines down in the local area, adding iron ore to your inventory
	'mine' : {
		'grp' : 'Gathering',
		'func' : function(cmd){

			addToInv('Iron Ore', 2, 1);

			// create cooldown
			createCooldown('mine', 60);
		}
	},
	// saves your user data to a JSON file in the 'saves' folder
	'save' : {
		'grp' : 'Profile',
		'func' : function(cmd){
			if(Object.keys(userData).length > 0){
				if(userData.gen.dt2.length > 0){
					fs.writeFile('./saves/' + userData.gen.dt2 + '.json', JSON.stringify(userData), function(err) {
					    if(err){
					    	console.log(err);
					    }
					    console.log('\n   Your progress was saved.\n');
					});
				}
			}
			else{
				console.log('\n   Save failed. No profile loaded.\n')
			}
		}
	},
	// exits the game
	'exit' : {
		'grp' : 'Miscellaneous',
		'func' : function(cmd){
			rl.close();
			console.log('\n !======================================================!');
			process.exit(0);
		}
	},

	'health' : {
		'func' : function(cmd){
			console.log(`\n   Your HP: (${userData.gen.hp}/${userData.gen.hpm}).\n`);
		}
	},

	'hp' : {
		'func' : function(cmd){
			commandMap['health'].func(cmd);
		}
	},

	'ap' : {
		'func' : function(cmd){
			console.log(`\n   Your AP: (${userData.gen.ap}/${userData.gen.apm}).\n`);
		}
	}
};	

function run(){

	// code that runs on startup
	if(sessionData.cycle === 0){
		loadResources();

		console.log('\n !=============== [Welcome to Test RPG!] ===============!');
		commandMap['profiles'].func('');
		console.log('   Use the \'new\' command followed by your desired\n   username to start a new game or \'load\' followed by the\n   username of your desired profile to load a previously\n   saved game.\n');
		console.log('   For help, use \'commands\' to display a list of\n   commands that can be used in the game.\n');
	}

	rl.question(' ', (command) => {

		//check if last command's expected additional inputs have been met
		/*if(sessionData.linesSince < commandMap[sessionData.lastCmd].expIn){

		}*/

		var commands = command.split(' ');

		var root_command = commands[0];
		//commandMap[root_command].func(commands);

		// check if root_command is an actual command
		if(cmdExists(root_command)){

			// check if the command is allowed in the current mode
			if(checkMode(root_command)){

				// check for cooldown on command
				var hasCooldown = checkCooldown(root_command);
				if(hasCooldown === false){

					// if none of the above, run command
					commandMap[root_command].func(commands);
					sessionData.lastCmd = root_command;
				}
				else{
					var unit = 'seconds';
					if(hasCooldown > 3599){
						hasCooldown = Math.floor(hasCooldown / 3600);
						unit = 'hours';
					}
					else if(hasCooldown > 59){
						hasCooldown = Math.floor(hasCooldown / 60);
						unit = 'minutes';
					}
					console.log(`\n   That command is not ready yet. ${hasCooldown} ${unit} left until ready.\n`);
				}
			}
			else{
				console.log('\n   That command is not allowed right now. Create or load a profile, then try again.\n');
			}
		}
		else{
			console.log(`\n   '${root_command}' is not recognized as a command. For a list of valid commands, type 'commands'.\n`);
			sessionData.linesSince++;
		}

		sessionData.cycle++;

		run();
	});
}

run();