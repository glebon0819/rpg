const readlineSync = require('readline-sync');
const fs = require('fs');
const util = require('./library/modules/util');
const inv = require('./library/modules/inv');

var userData = {},
	items = {},
	monsters = {},
	config = {};

var replenish = null;

var sessionData = {
	// keeps track of how many lines the user has entered
	'cycle' : 0,
	// keeps track of the last actual command to be entered
	'lastCmd' : '',
	// tracks the number of lines entered since the last command
	'linesSince' : 0,
	'mode' : 'start'
};

// function that loads the library files
function loadResources(){
	items = JSON.parse(fs.readFileSync('./library/encyclopedia.json', 'utf8'));
	inv.setItems(items);
	monsters = JSON.parse(fs.readFileSync('./library/bestiary.json', 'utf8'));
	locations = JSON.parse(fs.readFileSync('./library/atlas.json', 'utf8'));
	config = JSON.parse(fs.readFileSync('./library/config.json', 'utf8'));
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
	if(Object.keys(config.modes[sessionData.mode].white).length > 0){
		for(var commandKey in config.modes[sessionData.mode].white){
			if(config.modes[sessionData.mode].white[commandKey] == cmd){
				allowed = true;
			}
		}
	}
	else{
		allowed = true;
		for(var commandKey in config.modes[sessionData.mode].black){
			if(config.modes[sessionData.mode].black[commandKey] == cmd){
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
	userData.cooldowns[cmd] = { beg : util.getTimestamp(false), dur : sec };
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
	if(userData.cooldowns !== undefined){
		Object.keys(userData.cooldowns).forEach(command => {
			if(command == cmd){
				timeleft = userData.cooldowns[command].dur - Math.floor((util.getTimestamp(false) - userData.cooldowns[command].beg) / 1000);
			}
		});
	}

	return timeleft;
}

// creates a buff, which is a temporary boost in stats
function createBuff(stat, pts, sec, src){

	// adds a buff to the userData
	var id = util.getTimestamp(true);
	userData.buffs[id] = { stat : stat, pts : pts, dur : sec, src : src };
	userData.stats[stat] += parseInt(pts);

	// creates a timer to remove the buff
	setTimeout(removeBuff, sec * 1000, id);

}

// removes a buff from the userData
function removeBuff(id){

	// removes additional stat points from the buff
	userData.stats[userData.buffs[id].stat] -= userData.buffs[id].pts;

	// removes buff from buff object
	delete userData.buffs[id];

}

// cleans up cooldowns, buffs, etc. that are left over from the last session
// removes expired things and sets timeouts and intervals for things that are still active
function cleanUp(){

	// goes through each cooldown, removes expired ones and sets new timers for ones that should still be active
	for(var command in userData.cooldowns){
		var timeleft = userData.cooldowns[command].dur - Math.floor((util.getTimestamp(false) - userData.cooldowns[command].beg) / 1000);
		if(timeleft > 0){
			setTimeout(removeCooldown, timeleft * 1000, command);
		}
		else{
			delete userData.cooldowns[command];
		}
	}

	// goes through each buff, restarts them from where they left off
	for(var buff in userData.buffs){
		setTimeout(removeBuff, userData.buffs[buff].dur * 1000 - (new Date(userData.gen.sve) - new Date(buff)), buff);
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

// removes item from inventory and applies its buffs and effects
function consume(itm){
	// get id of item from inventory and use it to access item's description in encyclopedia
	//var id = userData.inv[itm];
	var id = inv.isInInv(itm);

	var itemBuffs = items[id].buffs;
	if(itemBuffs !== undefined && Object.keys(itemBuffs).length > 0){
		var userBuffCount = {};
		var itemBuffCount = {};

		// goes through each buff in user's data and makes sure its stack is not maxed out
		for(var buff in userData.buffs){

			if(userBuffCount[userData.buffs[buff].stat] !== undefined){
				userBuffCount[userData.buffs[buff].stat]++;
			}
			else{
				userBuffCount[userData.buffs[buff].stat] = 1;
			}
		}

		// goes through each buff an item has and makes sure its consumption would not cause stats to exceed the maximum number allowed
		for(var buff in itemBuffs){
			if(itemBuffCount[buff] !== undefined){
				itemBuffCount[buff]++;
			}
			else{
				itemBuffCount[buff] = 1;
			}

			// if the number of buffs found for the current stat on the item plus the number of buffs already had by the user for that stat exceeds the maximum allowed, throw error
			if((itemBuffCount[buff] + userBuffCount[buff]) > config.BUFF_STACK_MAX){
				throw `You cannot stack more than ${config.BUFF_STACK_MAX} buffs for the same stat on top of one another.`;
			}
		}

		for(var buff in itemBuffs){
			createBuff(buff, itemBuffs[buff].pts, itemBuffs[buff].dur, itm);
		}
	}

	inv.remFromInv(id, 1);

	var effects = items[id].effects;
	for(var effect in effects){
		if(effect == 'hp'){
			changeHP(effects[effect]);
		}
		else if(effect == 'ap'){
			changeAP(effects[effect]);
		}
	}
}

// adds a number to AP (including negatives)
// if AP is > max, sets AP to max; if AP < 0, sets AP to 0
function changeAP(val){
	userData.gen.ap += val;
	if(userData.gen.ap >= userData.gen.apm){
		userData.gen.ap = userData.gen.apm;
	}
	else if(userData.gen.ap < 0){
		userData.gen.ap = 0;
	}

	// set the last time AP was changed to now
	userData.gen.apc = util.getTimestamp(true);

	//console.log(`   ${(val > 0 ? '+' : '-')}  AP: (${userData.gen.ap}/${userData.gen.apm}).\n`);
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

	console.log(`   ${(val > 0 ? '+' : '-')}  HP: (${userData.gen.hp}/${userData.gen.hpm}).\n`);

	if(userData.gen.hp === 0){
		die();
	}
}

// checks if AP is above or equal to a given value
function checkAP(num){
	fixAP();

	return (userData.gen.ap >= num ? true : false);
}

// returns number of milliseconds that should elapse between AP points being regenerated
function getAPIncrement(){
	// default value for now
	// eventually this value will be affected by the user's stats
	return 3000;
}

// gets AP back up to where it is supposed to be (according to the increment and how many milliseconds have elapsed)
function fixAP(){
	if(userData.gen.ap < userData.gen.apm){
		var lastTime = new Date(userData.gen.apc);
		var currentTime = new Date(util.getTimestamp(true));
		if((currentTime - lastTime) >= getAPIncrement()){
			changeAP(Math.floor((currentTime - lastTime) / getAPIncrement()));
		}
	}
}

// kills the player, resetting their userData and sending them back into start mode
function die(){
	// retrieve their last save, autoincrement their death stat, then resave it
	var data = JSON.parse(fs.readFileSync('./saves/' + userData.gen.dt2 + '.json', 'utf8'));
	userData = data;
	userData.gen.dth++;
	//commandMap['save'].func();
	fs.writeFileSync('./saves/' + userData.gen.dt2 + '.json', JSON.stringify(userData));

	userData = {};

	sessionData.mode = 'start';

	console.log('   -  You have died! :(\n');
}

// adds item to player's equipment, removing it from their inventory
function equip(og){
	// checks that the max number of items for this slot will not be surpassed
	var item_count = 0;
	for(var item in userData.equipment[items[og].slt]){
		item_count += userData.equipment[items[og].slt][item].qty;
	}

	//if(Object.keys(userData.equipment[items[og].slt]).length < config.equipment[items[og].slt].ITEM_COUNT_MAX){
	if(item_count < config.equipment[items[og].slt].ITEM_COUNT_MAX){
		// adds the item to the appropriate equipment slot
		if(userData.equipment[items[og].slt][og] === undefined){
			userData.equipment[items[og].slt][og] = { qty : 1 };
		}
		else{
			userData.equipment[items[og].slt][og].qty++;
		}

		// goes through each of the item's stat increases and boosts the user's stats
		for(var stat in items[og].stats){
			userData.stats[stat] += items[og].stats[stat];
		}
	
		// removes the item from player inventory
		inv.remFromInv(og, 1);
	}
	else{
		throw `Number of items allowed in your ${items[og].slt} slot has been reached. Unequip an item in that slot to free up room.`;
	}
}

// removes an item from player's equipment, adding it to their inventory and removing any stat increases
function unequip(og){
	inv.addToInv(og, 1, false);

	// goes through each of the item's stat increases and reduces the user's stats
	for(var stat in items[og].stats){
		userData.stats[stat] -= items[og].stats[stat];
	}

	if(userData.equipment[items[og].slt][og].qty > 1){
		userData.equipment[items[og].slt][og].qty--;
	}
	else{
		delete userData.equipment[items[og].slt][og];
	}
}

// returns the slot an item is in if an item is equipped, false if not
function isInEqp(itm){
	var isInEqp = false;
	Object.keys(userData.equipment).forEach(slot => {
		for(var item in userData.equipment[slot]){
			if(item == itm){
				isInEqp = slot;
			}
		}
	});
	return isInEqp;
}

// checks if item has been renamed; if so returns its new name, if not returns false
function hasNewName(og){
	var newName = false;

	if(userData.renames[og] !== undefined){
		newName = userData.renames[og];
	}

	return newName;
}

// maps commands to functions and includes data about commands
var commandMap = {
	// creates a new game profile
	'new' : {
		// what command group it belongs to
		'grp' : 'Profile',
		'des' : '<profile name> - Creates a new profile, loading default user data and starting your first game.',
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
					userData = config.defaultProfile;
					userData.gen.nam = username;
					userData.gen.dat = util.getTimestamp(true);
					userData.gen.dt2 = util.getTimestamp(false);

					inv.setUserData(userData);

					sessionData.mode = 'general';
					console.log(`\n   Welcome, ${userData.gen.nam}!\n   Your profile was created at ${userData.gen.dat}.`);

					commandMap['me'].func();

				}
				else{
					console.log('\n   That username is unavailable.\n');
				}
			}
			else {
				console.log('\n  No username provided.\n');
			}
		}
	},
	// displays a list of save profiles on the player's disk
	'profiles' : {
		'grp' : 'Profile',
		'des' : '- Displays a list of profiles on your disc.',
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
		'des' : '<profile name> - Loads the saved game from a profile on disc and resumes your last game.',
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

					inv.setInventory(userData.inv);

					sessionData.mode = 'general';
					
					// clean up cooldowns, buffs, etc. left over from last session
					cleanUp();

					console.log(`\n   Welcome back, ${userData.gen.nam}!`);

					commandMap['me'].func();
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
		'des' : '<profile name> - Deletes a profile, permanently removing its file from your disc.',
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
					/*fs.unlink('./saves/' + filename, (err) => {
						if (err) throw err;
						console.log(`\n   ${profileName} was deleted.\n`);
					});*/
					fs.unlink('./saves/' + filename);
					console.log(`\n   ${profileName} was deleted.\n`);
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
		'des' : '- Displays a list of usable commands.',
		'func' : function(cmd){
			console.log(`\n   Commands\n ========================================================\n`);
			var lists = {};
			var cmds = Object.keys(commandMap);
			cmds.forEach(cmd => {
				if(lists[commandMap[cmd].grp] === undefined){
					lists[commandMap[cmd].grp] = [];
				}
				lists[commandMap[cmd].grp].push(cmd);
			});
			for(var group in lists){
				util.echo(`[${group}]:`);
				util.echo(lists[group].join(', '));
				console.log();
			}
		}
	},
	// shows the user a list of the items in their inventory
	'inventory' : {
		'grp' : 'Inventory',
		'des' : '- Displays the contents of your inventory.',
		'func' : function(cmd){
			if(Object.keys(userData.inv).length > 0){
				console.log(`\n ========================================================\n   ${userData.gen.nam}'s Inventory\n --------------------------------------------------------\n`)
				var itms = Object.keys(userData.inv);
				itms.forEach(item => {
					console.log('   ' + userData.inv[item].qty + ` x ${(hasNewName(item) !== false ? hasNewName(item) : items[item].nam)}`);
				});
				console.log('\n ========================================================\n');
			}
			else{
				console.log('\n   Your inventory is empty.\n');
			}
		}
	},
	// shorthand version of 'inventory'
	'inv' : {
		'grp' : 'Inventory',
		'des' : '- See \'inventory\'.',
		'func' : function(cmd){
			commandMap['inventory'].func(cmd);
		}
	},
	// drops an item from inventory
	'drop' : {
		'grp' : 'Inventory',
		'des' : '<item in inventory> - Drops an item, permanently removing it from your inventory.',
		'func' : function(cmd){
			cmd.shift();
			var item = cmd.join(' ');
			var id = inv.itmExists(item);

			if(item.length > 0){
				if(id !== false){
					inv.remFromInv(id, 1)
					console.log();
					util.echo(`'${item}' dropped from inventory.`);
					console.log();
				}
				else{
					console.log();
					util.echo(`Failed to drop '${item}'. No such item found in your inventory.`);
					console.log();
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
		'des' : '- Displays your stats.',
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
		'des' : '<number of points> <stat to assign points to> - Assigns unassigned stat points.',
		'func' : function(cmd){
			cmd.shift();
			if(Object.keys(cmd).length === 2){
				if(isStat(cmd[Object.keys(cmd)[1]])){
					if(parseInt(cmd[Object.keys(cmd)[0]]) > 0){
						if(userData.gen.poi >= parseInt(cmd[Object.keys(cmd)[0]])){
							userData.stats[cmd[Object.keys(cmd)[1]]] += parseInt(cmd[Object.keys(cmd)[0]]);
							userData.gen.poi -= parseInt(cmd[Object.keys(cmd)[0]]);
							console.log(`\n   '${cmd[Object.keys(cmd)[1]]}' changed to ${userData.stats[cmd[Object.keys(cmd)[1]]]}.\n`);
						}
						else{
							console.log('\n   Insufficient unassigned stat points to make that assignment.\n');
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
				console.log();
				util.echo('Arguments improperly given. Give a stat followed by the number of points you would like to assign to that stat.');
				console.log();
			}
		}
	},
	// shows the user general information about themself
	'me' : {
		'grp' : 'Stats',
		'func' : function(cmd){
			console.log(`
   ${userData.gen.nam}:

   +  Level: ${userData.gen.lvl}
   +  XP: ${userData.gen.exp}/${config.levels[userData.gen.lvl].XP_CAP}
   +  Gold: ${userData.gen.gld}
   +  Unassigned stat points: ${userData.gen.poi}
				`);
		}
	},
	// can be used to consume beverages and potions
	'drink' : {
		'grp' : 'Inventory',
		'des' : '<beverage or potion item in inventory> - Drinks a beverage or potion, giving you any effects it has.',
		'func' : function(cmd){
			cmd.shift();
			var itm = cmd.join(' ');

			// check if item is defined
			if(itm.length > 0){
				// check if is in inventory
				var id = inv.isInInv(itm);
				if(id !== false){
					// check if is food
					if(items[id].typ == 'potion' || items[id].typ == 'beverage'){
						// consume (which removes it from inventory and applies the buff/effect)
						try{
							console.log(`\n   You drink '${itm}'.\n`);
							consume(itm);
						}
						catch(err){
							console.log(`   Failed to drink '${itm}'. ${err}\n`);
						}
					}
					else{
						console.log('\n   You cannot drink that item.\n');
					}
				}
				else{
					console.log(`\n   '${itm}' not found in your inventory.\n`);
				}
			}
			else{
				console.log('\n   No item provided to drink.\n');
			}
		}
	},
	// can be used to consume food items
	'eat' : {
		'grp' : 'Inventory',
		'des' : '<food item in inventory> - Eats a piece of food, giving you any effects it has.',
		'func' : function(cmd){
			cmd.shift();
			var itm = cmd.join(' ');

			// check if item is defined
			if(itm.length > 0){
				// check if is in inventory
				var id = inv.isInInv(itm);
				if(id !== false){
					// check if is food
					if(items[id].typ == 'food'){
						// consume (which removes it from inventory and applies the buff/effect)
						try{
							console.log(`\n   You ate '${itm}'.\n`);
							consume(itm);
						}
						catch(err){
							console.log(`\n   Failed to eat '${itm}'. ${err}\n`);
						}
					}
					else{
						console.log('\n   You cannot eat that item.\n');
					}
				}
				else{
					console.log(`\n   '${itm}' not found in your inventory.\n`);
				}
			}
			else{
				console.log('\n   No item provided to eat.\n');
			}
		}
	},
	// continues your latest battle
	'adv' : {
		'grp' : 'Miscellaneous',
		'des' : '- Begins an adventure.',
		'func' : function(cmd){
			console.log('\n   You\'re now on an adventure.\n');
		}
	},
	// forages in the local area, adding berries to your inventory
	'forage' : {
		'grp' : 'Gathering',
		'des' : '- Forages in the local area, placing yielded food in your inventory.',
		'func' : function(cmd){
			
			if(checkAP(5)){
				inv.addToInv(6, 2, true);
				changeAP(-5);
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}

			// create cooldown
			//createCooldown('forage', 20);
		}
	},
	// fishes in the local area, adding fish to your inventory
	'fish' : {
		'grp' : 'Gathering',
		'des' : '- Fishes in the local area, placing yielded fish in your inventory.',
		'func' : function(cmd){

			if(checkAP(10)){
				inv.addToInv(3, 1, true);
				changeAP(-10);
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}

			// create cooldown
			//createCooldown('fish', 30);
		}
	},
	// chops down in the local area, adding logs to your inventory
	'chop' : {
		'grp' : 'Gathering',
		'des' : '- Chops wood in the local area, placing yielded wood in your inventory.',
		'func' : function(cmd){

			if(checkAP(20)){
				inv.addToInv(2, 1, true);
				changeAP(-20);
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}

			// create cooldown
			//createCooldown('chop', 30);
		}
	},
	// mines down in the local area, adding iron ore to your inventory
	'mine' : {
		'grp' : 'Gathering',
		'des' : '- Mines in the local area, placing yielded ore in your inventory.',
		'func' : function(cmd){

			if(checkAP(50)){
				inv.addToInv(4, 1, true);
				changeAP(-50);
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}

			// create cooldown
			//createCooldown('mine', 60);
		}
	},
	// saves your user data to a JSON file in the 'saves' folder
	'save' : {
		'grp' : 'Profile',
		'des' : '- Saves your current profile data to the disc so you can resume your game later.',
		'func' : function(cmd){
			if(Object.keys(userData).length > 0){

				// sets last save value in user data to current time
				userData.gen.sve = util.getTimestamp(true);

				// saves user data to disc as a JSON file
				if(userData.gen.dt2.length > 0){
					fs.writeFileSync('./saves/' + userData.gen.dt2 + '.json', JSON.stringify(userData));
					console.log('\n   Your progress was saved.\n');
				}
			}
			else{
				console.log('\n   Save failed. No profile loaded.\n');
			}
		}
	},
	// exits the game
	'exit' : {
		'grp' : 'Miscellaneous',
		'des' : '- Ends your current game and closes the program.',
		'func' : function(cmd){
			var sure = readlineSync.keyInYNStrict('\n   Are you sure? Unsaved progress will be lost.');
			if(sure === true){
				console.log('\n !======================================================!');
				process.exit(0);
			}
			else{
				console.log();
				util.echo('Exit cancelled.');
				console.log();
			}
		}
	},

	'health' : {
		'grp' : 'Stats',
		'des' : '- Displays your HP level.',
		'func' : function(cmd){
			console.log(`\n   Your HP: (${userData.gen.hp}/${userData.gen.hpm}).\n`);
		}
	},

	'hp' : {
		'grp' : 'Stats',
		'des' : '- Displays your HP level.',
		'func' : function(cmd){
			commandMap['health'].func(cmd);
		}
	},

	'ap' : {
		'grp' : 'Stats',
		'des' : '- Displays your AP level.',
		'func' : function(cmd){
			fixAP();
			console.log(`\n   Your AP: (${userData.gen.ap}/${userData.gen.apm}).\n`);
		}
	},

	'inspect' : {
		'grp' : 'Inventory',
		'des' : '<item in inventory> - Displays an item\'s various qualities.',
		'func' : function(cmd){
			cmd.shift();
			var itm = cmd.join(' ');

			if(isInEqp(itm) !== false || inv.isInInv(itm) !== false){
				var qty = 0;
				var id = inv.itmExists(itm);

				if(isInEqp(itm) !== false){
					qty = userData.equipment[isInEqp(itm)][itm].qty;
				}
				if(inv.isInInv(itm)){
					qty += userData.inv[id].qty;
				}

				var properties = items[id];

				console.log(`\n   +  Quantity: ${qty}`);

				console.log(`   +  Type: ${properties.typ}`);

				console.log(`   +  Value: ${properties.val}`);

				if(properties.typ == 'food' || properties.typ == 'beverage' || properties.typ == 'potion'){
					console.log('   +  Effects:');
					if(properties.effects.hp !== undefined){
						console.log(`      ${properties.effects.hp > 0 ? '+' : '-'}  ${Math.abs(properties.effects.hp)} HP`);
					}
					//if(typeof properties.effects.ap !== undefined){
					if(properties.effects.ap !== undefined){
						console.log(`      ${properties.effects.ap > 0 ? '+' : '-'}  ${Math.abs(properties.effects.ap)} AP`);
					}
				}

				if(properties.typ == 'weapon' || properties.typ == 'armor'){

					//console.log(`   ${userData.inv[itm].hp > 0 ? '+' : '-'}  Condition: (${userData.inv[itm].hp}/${properties.hpm})`);

					//console.log(`   +  True Value: ${(properties.val * userData.inv[itm].hp) / properties.hpm}`);

					if(properties.typ == 'weapon'){
						console.log(`   +  Damage: ${properties.dmg}`);
					}
					if(properties.typ == 'armor'){
						console.log(`   +  Armor: ${properties.arm}`);
						console.log(`   +  Slot: ${properties.slt}`);
					}

					console.log('   +  Stats:');
					for(var stat in properties.stats){
						console.log(`      ${properties.stats[stat] > 0 ? '+' : '-'}  ${Math.abs(properties.stats[stat])} ${stat}`);
					}
				}

				console.log();
			}
			else{
				console.log('\n   That item could not be found in your inventory.\n');
			}
		}
	},

	// displays description of a command
	'info' : {
		'grp' : 'Miscellaneous',
		'des' : '<command> - Displays the description of a command.',
		'func' : function(cmd){
			cmd.shift();
			var command = cmd.join(' ');

			if(command.length > 0){
				if(cmdExists(command)){
					console.log(`\n   ${command} ${commandMap[command].des}\n`);
				}
				else{
					console.log(`\n   That command does not exist.\n`);
				}
			}
			else{
				console.log('\n   No command provided.\n');
			}
		}
	},

	'colors' : {
		'func' : function(cmd){
			console.log('\x1b[5m%s\x1b[0m', '\n   I am red.\n');
		}
	},

	// displays list of current buffs, their stats and their additional points
	'buffs' : {
		'grp' : 'Stats',
		'des' : '- Displays a list of your current buffs.',
		'func' : function(cmd){
			if(Object.keys(userData.buffs).length > 0){
				console.log();
				for(var buff in userData.buffs){
					console.log(`   +  '${userData.buffs[buff].src}': ${userData.buffs[buff].pts} ${userData.buffs[buff].stat}`);
				}
				console.log();
			}
			else{
				console.log('\n   You currently have no buffs.\n');
			}
		}
	},

	// removes an item from the player inventory, adding it to the appropriate equipment slot
	'equip' : {
		'grp' : 'Equipment',
		'des' : '<equippable item in inventory> - Removes an item from your inventory, adding it to your equipment in the appropriate slot.',
		'func' : function(cmd){
			cmd.shift();
			var item = cmd.join(' ');

			if(item.length > 0){
				// checks that the item given exists in the user's inventory
				var id = inv.isInInv(item);
				if(id !== false){
					// checks that the item is equippable
					if(items[id].slt !== undefined){
						try{
							equip(id);
							console.log(`\n   '${item}' equipped.\n`);
						}
						catch(err){
							console.log();
							util.echo(`\n   Item could not be equipped. ${err}\n`);
							console.log();
						}
					}
					else{
						console.log('\n   That item cannot be equipped.\n');
					}
				}
				else{
					console.log(`\n   That item could not be found in your inventory.\n`);
				}
			}
			else{
				console.log('\n   No item provided to equip.\n');
			}
		}
	},

	'unequip' : {
		'grp' : 'Equipment',
		'des' : '<currently equipped item> - Removes an item from your equipment, adding it to your inventory.',
		'func' : function(cmd){
			cmd.shift();
			var item = cmd.join(' ');

			if(item.length > 0){
				// get original id number, throw exception if cannot be found
				var og = inv.itmExists(item);

				if(og !== false){
					unequip(og);
					console.log(`\n   '${item}' removed from your equipment.\n`);
				}
				else{
					console.log();
					util.echo('Item could not be unequipped. Item could not be found in your equipment.');
					console.log();
				}
			}
		}
	},

	// displays the contents of the player's inventory
	'equipment' : {
		'grp' : 'Equipment',
		'des' : '- Displays the contents of your inventory.',
		'func' : function(cmd){
			console.log();
			for(var slot in userData.equipment){
				console.log(`   ${slot}:`);
				for(var itmId in userData.equipment[slot]){
					util.echo(`   +  ${userData.equipment[slot][itmId].qty} x ${(hasNewName(itmId) !== false ? hasNewName(itmId) : items[itmId].nam)}`);
				}
			}
			console.log();
		}
	},

	// make a shorter alternate name for 'equipment'
	'eqp' : {
		'grp' : 'Equipment',
		'des' : '- See \'equipment\'.',
		'func' : function(cmd){
			commandMap['equipment'].func(cmd);
		}
	},

	// displays a brief guide on how to play the game and directs the player to some other helpful commands
	'help' : {
		'grp' : 'Miscellaneous',
		'des' : '- Displays a short guide on how to play the game.',
		'func' : function(cmd){
			// explain how to enter commands into the console
			console.log();
			util.echo('To play the game, enter commands and use the game\'s feedback to determine your next course of action. You use commands to manage your inventory, equipment, and stats, go on adventures, buy and sell items, etc.');
			console.log();

			util.echo('Ex: assign 5 strength');
			console.log();
			util.echo('Above, the \'assign\' command was used, followed by the number of points they wanted to assign, then followed finally by the stat they wanted to assign points to. Information about what different commands do can be found using the commands below.');
			console.log();

			// define some helpful commands that they can go to next, such as 'commands' and 'info'
			util.echo('Other helpful commands to get you started:');
			console.log();
			util.echo('+ \'commands\' - displays a list of commands by what category they fall within.');
			console.log();
			util.echo('+ \'info\' <command> - typing info followed by a command will give you more information about that command, such as what it does and what information it requires you to input in order to function and what order it requires that information.');
			console.log();
		}
	},

	// renames an item
	'rename' : {
		'grp' : 'Inventory',
		'des' : '<item in inventory or equipment> - renames an item.',
		'func' : function(cmd){
			cmd.shift();
			var itm = cmd.join(' ');

			// verify that the item they chose to rename exists
			var id = inv.itmExists(itm);
			if(id !== false){
				var newName = readlineSync.question(' New name: ');

				// verify that the new name is not already taken
				if(inv.itmExists(newName) === false){

					// get the original ID number for the item 

					// add the rename to the user's data
					//userData.renames[newName] = id;
					userData.renames[id] = newName;

					console.log();
					util.echo(`'${itm}' renamed to '${newName}'.`);
					console.log();
				}
				else{
					console.log();
					util.echo('An item with that name already exists.');
					console.log();
				}
			}
			else{
				console.log();
				util.echo('That item does not exist.');
				console.log();
			}
		}
	}
};

function run(){

	// code that runs on startup
	if(sessionData.cycle === 0){
		loadResources();

		console.log('\n !=============== [Welcome to Test RPG!] ===============!');
		commandMap['profiles'].func('');
		//console.log('   Use the \'new\' command followed by your desired\n   username to start a new game or \'load\' followed by the\n   username of your desired profile to load a previously\n   saved game.\n');
		util.echo('Use the \'new\' command followed by your desired username to start a new game or \'load\' followed by the username of your desired profile to load a previously saved game.');
		console.log();
		//console.log('   For help, use \'commands\' to display a list of\n   commands that can be used in the game.\n');
		util.echo('For help, use \'commands\' to display a list of commands that can be used in the game.');
		console.log();
	}

	var command = readlineSync.question(' ');

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
				//console.log(`\n   That command is not ready yet. ${hasCooldown} ${unit} left until ready.\n`);
				console.log();
				util.echo(`That command is not ready yet. ${hasCooldown} ${unit} left until ready.`);
				console.log();
			}
		}
		else{
			//console.log('\n   That command is not allowed right now. Create or load a profile, then try again.\n');
			console.log();
			util.echo('That command is not allowed right now. Create or load a profile, then try again.');
			console.log();
		}
	}
	else{
		//console.log(`\n   '${root_command}' is not recognized as a command. For a list of valid commands, type 'commands'.\n`);
		console.log();
		util.echo(`'${root_command}' is not recognized as a command. For a list of valid commands, type 'commands'.`);
		console.log();
		sessionData.linesSince++;
	}

	sessionData.cycle++;

	run();
}

run();