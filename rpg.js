const readlineSync = require('readline-sync');
const chalk = require('chalk');
const fs = require('fs');
const util = require('./library/modules/util');
const itemMod = require('./library/modules/items');
const loc = require('./library/modules/loc');
const stats = require('./library/modules/stats');

var userData = {},
	items = {},
	monsters = {},
	locations = {},
	config = {};

var replenish = null;

var sessionData = {
	// keeps track of how many lines the user has entered
	'cycle' : 0,
	// keeps track of the last actual command to be entered
	'lastCmd' : '',
	// tracks the number of lines entered since the last command
	'linesSince' : 0,
	'mode' : 'start',
	'enemy' : null,
	'commandHistory' : ''
};

// function that loads the library files
function loadResources(){
	items = JSON.parse(fs.readFileSync('./library/encyclopedia.json', 'utf8'));
	monsters = JSON.parse(fs.readFileSync('./library/bestiary.json', 'utf8'));
	locations = JSON.parse(fs.readFileSync('./library/atlas.json', 'utf8'));
	config = JSON.parse(fs.readFileSync('./library/config.json', 'utf8'));
	recipes = JSON.parse(fs.readFileSync('./library/cookbook.json', 'utf8'));

	itemMod.setItems(items);
	itemMod.setRecipes(recipes);
	itemMod.setConfig(config);
	loc.setLocations(locations);
	stats.setItems(items);
	stats.setConfig(config);
	stats.setSession(sessionData);
	util.setConfig(config);
	util.setCommands(commandMap);
}

// function for retrieving saves from the save folder
function getSaves(){
	var saves = [];
	try {
		var files = fs.readdirSync('saves');
		files.forEach(file => {
			//console.log(file);
			var json = fs.readFileSync('./saves/' + file, 'utf8');
			var data = JSON.parse(json);
			var name = data.gen.nam;
			saves.push({file : file, name : data.gen.nam, date : data.gen.dat});
		});
	}
	catch(error) {
		fs.mkdirSync('./saves/');
	}
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
	var done = false;
	var whiteGrpExists = false;
	var blackGrpExists = false;
	
	// if group whitelist is defined, use that
	if(Object.keys(config.modes[sessionData.mode].whiteGroup).length > 0) {
		//console.log('white group used')
		whiteGrpExists = true;
		for(var whiteGroup in config.modes[sessionData.mode].whiteGroup){
			if(util.getCmdGrp(cmd) !== null && config.modes[sessionData.mode].whiteGroup[whiteGroup] == util.getCmdGrp(cmd)){
				allowed = true;
				done = true;
			}
		}
	}

	// else use group blacklist
	else if(Object.keys(config.modes[sessionData.mode].blackGroup).length > 0) {
		//console.log('black group used');
		blackGrpExists = true;
		for(var commandGroup in config.modes[sessionData.mode].blackGroup){
			if(config.modes[sessionData.mode].blackGroup[commandGroup] == util.getCmdGrp(cmd)){
				allowed = false;
				done = true;
			}
		}
	}

	// if whitelist is defined, use that
	if(!allowed) {
		if(Object.keys(config.modes[sessionData.mode].white).length > 0){
			//console.log('white list used')
			if(!blackGrpExists) {
				allowed = false;
			}
			for(var commandKey in config.modes[sessionData.mode].white){
				if(config.modes[sessionData.mode].white[commandKey] == cmd){
					allowed = true;
				}
			}
		}
	}

	// else use blacklist
	//else{
	if(Object.keys(config.modes[sessionData.mode].black).length > 0){
		//console.log('black list used')
		if(!whiteGrpExists) {
			allowed = true;
		}
		for(var commandKey in config.modes[sessionData.mode].black){
			if(config.modes[sessionData.mode].black[commandKey] == cmd){
				if(!done) {
					allowed = false;
				}
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
	/*for(var buff in userData.buffs){
		setTimeout(removeBuff, userData.buffs[buff].dur * 1000 - (new Date(userData.gen.sve) - new Date(buff)), buff);
	}*/
}

// sets the userData object for each of the game's modules
function setUserData(data){
	itemMod.setUserData(data);
	loc.setUserData(data);
	stats.setUserData(data);
}

function Monster(name) {
	this.nam = name;

	// establishes monster's health and max health
	this.hp = monsters[this.nam].hp;
	this.hpm = monsters[this.nam].hp;
	this.alive = true;

	this.xp = monsters[this.nam].xp;
	this.abilities = monsters[this.nam].abilities;
	this.loot = monsters[this.nam].loot;
	this.gold = monsters[this.nam].gold;

	// method for reducing the monster's hp
	this.subtractHp = function(points) {
		this.hp -= points;
		if(this.hp <= 0) {
			this.hp = 0;
			this.alive = false;
		}
	}

	// method for making the monster attack
	this.attack = function() {
		var abilities = Object.keys(this.abilities);
		var abilityIndex = util.randNum(abilities.length, 1);
		var attack = abilities[abilityIndex - 1];
		//var attack = util.randPick(this.abilities);
		var damage = (this.abilities[attack].dmg * -1) + userData.gen.arm;
		var armour = userData.gen.arm;

		if(damage > 0) {
			damage = 0;
		}
		util.echo(`${this.nam} attacks using ${attack}, dealing ${damage * -1} damage!`, false, true);
		stats.changeHp(damage);
	}

	// loots the monster, adding random items to the player's inventory
	this.lootCorpse = function() {
		var itemNumber = util.randNum(3 + (userData.stats.perception * 0.5), 1);
		for(var i = 0; i < itemNumber; i++) {
			itemMod.addToInv(util.randPick(this.loot), 1, true);
		}

		if(this.gold !== false){
			var gold = util.randFloat(this.gold, 0);
			itemMod.addGold(gold);
		}
	}
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
				var profileLength = username.length + 8 + 18;
				if(profileLength <= config.GAME_CHAR_WIDTH) {
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

						setUserData(userData);

						sessionData.mode = 'general';
						console.log(`\n   Welcome, ${userData.gen.nam}!\n   Your profile was created at ${userData.gen.dat}.`);

						commandMap['me'].func();
					}
					else{
						console.log('\n   That username is unavailable.\n');
					}
				}
				else {
					console.log('\n  Username too long. Usernames must be under 28 characters in length.\n');
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
					var date = profile.date.substring(0, profile.date.indexOf('T'));
					var profileLength = profile.name.length + 7 + 18;
					var spacer = ' ';
					var spacerWidth = config.GAME_CHAR_WIDTH - profileLength;
					switch(spacerWidth) {
						case 1:
							break;
						case 2:
							spacer += ' ';
							break;
						default:
							for(var i = 0; i < spacerWidth - 2; i++) {
								spacer += '.';
							}
							spacer += ' ';
							break;
					}
					console.log(`\n   +  "${profile.name}"${spacer}Created ${date}`);
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

					setUserData(userData);

					//sessionData.mode = 'general';
					sessionData.mode = userData.gen.mod;
					
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
			console.log();
			util.echo(util.generateSpacer('='), true, ' ');
			util.echo('Commands');
			util.echo(util.generateSpacer('-'), true, ' ');
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
			util.echo(util.generateSpacer('='), true, ' ');
			console.log();
		}
	},
	// shows the user a list of the items in their inventory
	'inventory' : {
		'grp' : 'Inventory',
		'des' : '- Displays the contents of your inventory.',
		'func' : itemMod.inventory
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
		'des' : '<item> - Drops an item, permanently removing it from your inventory.',
		'func' : itemMod.drop
	},
	// shows the user what stats they have
	'stats' : {
		'grp' : 'Stats',
		'des' : '- Displays your stats.',
		'func' : stats.stats
	},
	// used to assign points to different stats
	'assign' : {
		'grp' : 'Stats',
		'des' : '<number of points> <stat> - Assigns unassigned stat points.',
		'func' : stats.assign
	},
	// shows the user general information about themself
	'me' : {
		'grp' : 'Stats',
		'func' : function(cmd){
			stats.fixHp();
			stats.fixAp();
			// |///////////////////////////////=======================|
			console.log(`
   ${userData.gen.nam}:
   
   +  HP: ${userData.gen.hp}/${userData.gen.hpm}
   +  AP: ${userData.gen.ap}/${userData.gen.apm}
   +  Armour: ${userData.gen.arm}

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
		'des' : '<item> - Drinks a beverage or potion, giving you any effects it has.',
		'func' : stats.drink
	},
	// can be used to consume food items
	'eat' : {
		'grp' : 'Inventory',
		'des' : '<item> - Eats a piece of food, giving you any effects it has.',
		'func' : stats.eat
	},
	// continues your latest battle
	'adventure' : {
		'grp' : 'Adventure',
		'des' : '- Begins an adventure.',
		'func' : function(cmd){
			if(sessionData.enemy === null){
				sessionData.mode = 'adventure';
				sessionData.enemy = new Monster(util.randPick(locations[userData.location.prv].loc[userData.location.loc].cre));
				var enemy = sessionData.enemy;

				util.echo(`A ${enemy.nam} has appeared! You are now in combat.`, false, true);

				var enemyAgility = util.randNum(20, 1);
				var roll = util.roll();
				util.echo(`Agility check. Target: > ${enemyAgility}.`);
				util.echo(`Base agility: ${userData.stats.agility}.`);
				util.echo(`Rolled a ${roll}.`);
				var agility = userData.stats.agility + roll;
				util.echo(`${userData.stats.agility} + ${roll} ${agility > enemyAgility ? '>' : '<'} ${enemyAgility}`);
				if(userData.stats.agility + roll >= enemyAgility) {
					util.echo(`Passed!`);
					console.log('\n   You attack first!\n');
				} else {
					util.echo('Failed!');
					console.log();
					util.echo('They attack first!');
					enemy.attack();
				}
			}
			else{
				util.echo('You are already in a battle. You must defeat your enemy before you can start another battle.', false, true);
			}
		}
	},
	// alias for 'adventure'
	'adv' : {
		'grp' : 'Adventure',
		'des' : '- See \'adventure\'.',
		'func' : function(cmd){
			commandMap['adventure'].func(cmd);
		}
	},
	// flees your current adventure, putting the user back in general mode and resetting their session's enemy property
	'flee' : {
		'grp' : 'Adventure',
		'des' : '- Flees the current adventure.',
		'func' : function(cmd){
			sessionData.enemy = null;
			sessionData.mode = 'general';
			console.log('\n   You flee the battle.\n');
		}
	},
	// forages in the local area, adding berries to your inventory
	'forage' : {
		'grp' : 'Gathering',
		'des' : '- Forages in the local area, placing yielded food in your inventory.',
		'func' : function(cmd){
			
			if(stats.checkAp(10)){
				if(locations[userData.location.prv].loc[userData.location.loc].fge !== false){
					itemMod.addToInv(util.randPick(locations[userData.location.prv].loc[userData.location.loc].fge), 1, true);
					stats.changeAp(-10);
				}
				else{
					console.log();
					util.echo('There is nothing to forage here. Travel somewhere else to forage.');
					console.log();
				}
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}
			//createCooldown('forage', 20);
		}
	},
	// fishes in the local area, adding fish to your inventory
	'fish' : {
		'grp' : 'Gathering',
		'des' : '- Fishes in the local area, placing yielded fish in your inventory.',
		'func' : function(cmd){

			if(stats.checkAp(10)){
				if(locations[userData.location.prv].loc[userData.location.loc].fsh !== false){
					itemMod.addToInv(util.randPick(locations[userData.location.prv].loc[userData.location.loc].fsh), 1, true);
					stats.changeAp(-10);
				}
				else{
					console.log();
					util.echo('There is nowhere to fish here. Travel somewhere else to fish.');
					console.log();
				}
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}
		}
	},
	// chops down in the local area, adding logs to your inventory
	'chop' : {
		'grp' : 'Gathering',
		'des' : '- Chops wood in the local area, placing yielded wood in your inventory.',
		'func' : function(cmd){

			if(stats.checkAp(20)){
				if(locations[userData.location.prv].loc[userData.location.loc].chp !== false){
					itemMod.addToInv(util.randPick(locations[userData.location.prv].loc[userData.location.loc].chp), 1, true);
					stats.changeAp(-20);
				}
				else{
					console.log();
					util.echo('There is nothing to chop here. Travel somewhere else to chop.');
					console.log();
				}
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}
		}
	},
	// mines down in the local area, adding iron ore to your inventory
	'mine' : {
		'grp' : 'Gathering',
		'des' : '- Mines in the local area, placing yielded ore in your inventory.',
		'func' : function(cmd){

			if(stats.checkAp(50)){
				if(locations[userData.location.prv].loc[userData.location.loc].min !== false){
					itemMod.addToInv(util.randPick(locations[userData.location.prv].loc[userData.location.loc].min), 1, true);
					stats.changeAp(-50);
				}
				else{
					console.log();
					util.echo('There is nothing to mine here. Travel somewhere else to mine.');
					console.log();
				}
			}
			else{
				console.log('\n   Insufficient AP.\n');
			}
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
					userData.gen.mod = sessionData.mode;
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
				util.log(sessionData.commandHistory);
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
			stats.fixHp();
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
			stats.fixAp();
			console.log(`\n   Your AP: (${userData.gen.ap}/${userData.gen.apm}).\n`);
		}
	},

	'inspect' : {
		'grp' : 'Inventory',
		'des' : '<item in inventory> - Displays an item\'s various qualities.',
		'func' : itemMod.inspect
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
					console.log();
					util.echo(`${command} ${commandMap[command].des}\n`);
					console.log();
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
				var id = itemMod.isInInv(item, 1);
				if(id !== false && id !== undefined){
					// checks that the item is equippable
					if(items[id].slt !== undefined){
						try{
							itemMod.equip(id);
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
				var og = itemMod.itmExists(item);

				if(og !== false){
					itemMod.unequip(og);
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
		'func' : itemMod.equipment
	},

	// alias for 'equipment'
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

	// clears the screen
	'cls' : {
		'grp' : 'Miscellaneous',
		'des' : '- Clears the screen.',
		'func' : function(cmd){
			console.log('\033c');
		}
	},

	// renames an item
	'rename' : {
		'grp' : 'Inventory',
		'des' : '<item in inventory or equipment> - renames an item.',
		'func' : itemMod.rename
	},

	// displays a map of the current province to the player
	'map' : {
		'grp' : 'Location',
		'des' : '<+ or ++ to increase scope>(optional) - displays a map of the location you are currently in.',
		'func' : function(cmd){
			cmd.shift();
			console.log();
			if(cmd == '++') {
				util.echo('World:');
				util.renderMap('./library/resources/maps/World.txt');
			}
			else if(cmd == '+') {
				util.echo(`${userData.location.prv} Province:`);
				util.renderMap(locations[userData.location.prv].map);
			}
			else {
				util.echo(`${userData.location.loc}:`);
				util.renderMap(locations[userData.location.prv].loc[userData.location.loc].map);
			}
		}
	},

	// displays current province (quadrant) and specific location of the player
	'location' : {
		'grp' : 'Location',
		'des' : '- displays the current province and specific location within that province that you are in.',
		'func' : loc.location
	},

	// alias for 'location'
	'loc' : {
		'grp' : 'Location',
		'des' : '- see "location".',
		'func' : loc.location
	},

	// moves the player to a different location
	'travel' : {
		'grp' : 'Location',
		'des' : '- moves you to a different location.',
		'func' : loc.travel
	},

	// creates a campsite and puts you into camping mode
	// will require >= 3 wood to perform
	'camp' : {
		'grp' : 'Camping',
		'des' : '- creates a camp.',
		'func' : function(cmd) {
			if(stats.statCheck('agility', 2)){
				sessionData.mode = 'camp';
				console.log();
				util.render('./library/resources/images/campfire.txt');
				console.log();
				util.echo('You are now camping.');
				console.log();
			}
			else {
				console.log();
				util.echo('You cannot camp now.');
				console.log();
			}
		}
	},

	// leaves a campsite
	'leave' : {
		'grp' : 'Camping',
		'des' : '- leaves the campsite.',
		'func' : function(cmd) {
			sessionData.mode = 'general';
			console.log();
			util.echo('You left the campsite.');
			console.log();
		}
	},

	// leaves a campsite
	'rest' : {
		'grp' : 'Camping',
		'des' : '- begins resting, replenishing HP slowly.',
		'func' : function(cmd) {
			userData.gen.hpc = util.getTimestamp(true);
			sessionData.mode = 'rest';
			console.log();
			util.echo('You are now resting.');
			console.log();
		}
	},

	// wakes character from resting
	'wake' : {
		'grp' : 'Camping',
		'des' : '- wakes from resting.',
		'func' : function(cmd) {
			stats.fixHp();
			sessionData.mode = 'camp';
			console.log();
			util.echo('You awake from your rest.');
			console.log();
		}
	},

	// wakes character from resting
	'cook' : {
		'grp' : 'Camping',
		'des' : '<recipe name> - cooks raw food into cooked food.',
		'func' : function(cmd) {
			cmd.shift();
			var recipeName = cmd.join(' ').trim();

			if(recipeName.length > 0) {
				var recipe = itemMod.recipeExists(recipeName);
				if(recipe) {
					if(itemMod.recipeIsLearned(recipeName)) {
						var ingredients = recipe.rqs;
						var canBeMade = true;
						for(var ingredient in ingredients) {
							if(!itemMod.isInInv(ingredient, ingredients[ingredient])) {
								canBeMade = false;
								break;
							}
						}
						if(canBeMade) {
							for(var ingredient in ingredients) {
								itemMod.remFromInv(ingredient, ingredients[ingredient]);
							}
							itemMod.addToInv(recipe.out, recipe.qty, true);
						}
						else {
							console.log();
							util.echo('You lack the necessary ingredients.');
							console.log();
						}
					}
					else {
						console.log();
						util.echo('You do not know any recipes with this name. Use "view" to view your learned recipes.');
						console.log();
					}
				}
				else {
					console.log();
					util.echo('Recipe does not exist.');
					console.log();
				}
			}
			else {
				console.log();
				util.echo('No recipe name given.');
				console.log();
			}
		}
	},

	// views a list
	'view' : {
		'grp' : 'Miscellaneous',
		'des' : '<list> - lets you view the contents of a list.',
		'func' : function(cmd) {
			cmd.shift();
			var menu = cmd.join(' ').trim();
			var list;
			if(menu.length > 0) {
				switch(menu.trim().toLowerCase()) {
					case 'recipes':
						list = userData.recipes;
						break;
				}
				if(list !== null && list !== undefined){
					if(Object.keys(list).length > 0) {
						console.log();
						util.echo(`"${menu}":`);
						console.log();
						list.forEach(function(item) {
							util.echo(`+ ${item}`);
						});
						console.log();
					}
					else {
						console.log();
						util.echo(`Your "${menu}" list is empty.`);
						console.log();
					}
				}
				else {
					console.log();
					util.echo('That list does not exist.');
					console.log();
				}
			}
			else {
				console.log();
				util.echo('No list name provided. For instructions on how to use "view", use the "info" command.');
				console.log();
			}
		}
	},

	// reads a book, activating its effects
	'read' : {
		'grp' : 'Miscellaneous',
		'des' : '<book> - reads a book, activating any effects it has.',
		'func' : function(cmd) {
			cmd.shift();
			var book = cmd.join(' ').trim();
			if(book.length > 0) {
				book = itemMod.isInInv(book);
				if(book) {
					book = items[book];

					// checks if the book has any effects
					if(book.effects !== undefined && Object.keys(book.effects).length > 0) {

						// checks if the book has any learnable skills
						var skills =  book.effects.learn;
						if(skills !== undefined) {
							skills.forEach(function(skill) {
								if(skill.typ == 'recipe') {
									var recipe = skill.nam;
									userData.recipes.push(recipe);
									console.log();
									util.echo(`You learned a new recipe for "${recipe}"!`);
								}
							});
							console.log();
						}
						else {
							util.echo('This book has no learnable skills.');
							console.log();
						}
					}
					else {
						console.log();
						util.echo('This book has no effects.');
						console.log();
					}
				}
				else {
					console.log();
					util.echo('You do not posess a book with that title.');
					console.log();
				}
			}
			else {
				console.log();
				util.echo('No book name provided. For instructions on how to use "read", use the "info" command.');
				console.log();
			}
		}
	},

	// attacks the current enemy with the equipped weapon
	'attack' : {
		'grp' : 'Adventure',
		'des' : ' - attacks the current enemy with the equipped weapon.',
		'func' : function(cmd) {
			var damage = 0;
			var enemy = sessionData.enemy;
			if(Object.keys(userData.equipment.weapon).length > 0) {
				for(var weapon in userData.equipment.weapon) {
					damage += (items[weapon].dmg * userData.equipment.weapon[weapon].qty) + userData.stats.strength;
				}
				console.log();
				enemy.subtractHp(damage);
				util.echo(`Enemy's current health: ${enemy.hp}/${enemy.hpm}`);
				util.echo('You did ' + damage + ' damage!');
				if(!enemy.alive) {
					console.log();
					util.echo(`The ${enemy.nam} has been slain!`);
					stats.gainXp(enemy.xp);
					enemy.lootCorpse();
					sessionData.enemy = null;
					sessionData.mode = 'general';
				}
				else {
					enemy.attack();
				}
				console.log();
			}
			else {
				util.echo('You have no weapon equipped.', false, true);
			}
		}
	}
};

function run(){

	// code that runs on startup
	if(sessionData.cycle === 0){

		try {

			loadResources();

			console.log('\n !=================== [Welcome to SideDown!] ===================!');
			util.render('./library/resources/SideDown.txt');
			commandMap['profiles'].func('');
			//console.log('   Use the \'new\' command followed by your desired\n   username to start a new game or \'load\' followed by the\n   username of your desired profile to load a previously\n   saved game.\n');
			util.echo('Use the \'new\' command followed by your desired username to start a new game or \'load\' followed by the username of your desired profile to load a previously saved game.');
			console.log();
			//console.log('   For help, use \'commands\' to display a list of\n   commands that can be used in the game.\n');
			util.echo('For help, use \'commands\' to display a list of commands that can be used in the game.');
			console.log();
		}
		catch(error) {
			console.log();
			util.echo('Game configuration files corrupted. Please remove the current version of this game and download the latest stable version.');
			console.log();
			util.echo('Press any key to confirm that you understand and close the current instance.');
			console.log();
			util.echo(error.message);
			console.log();
			key = readlineSync.keyIn(' ', {hideEchoBack: true, mask: ''});
			return;
		}
	}

	var command = readlineSync.question(' ');
	sessionData.commandHistory += (util.getTimestamp(true) + '\r\n');
	sessionData.commandHistory += (command + '\r\n\r\n');

	//check if last command's expected additional inputs have been met
	/*if(sessionData.linesSince < commandMap[sessionData.lastCmd].expIn){

	}*/

	var commands = command.split(' ');

	var rootCommand = commands[0];
	//commandMap[rootCommand].func(commands);

	// check if rootCommand is an actual command
	if(cmdExists(rootCommand)){

		// check if the command is allowed in the current mode
		if(checkMode(rootCommand)){

			// check for cooldown on command
			var hasCooldown = checkCooldown(rootCommand);
			if(hasCooldown === false){

				// if none of the above, run command
				commandMap[rootCommand].func(commands);
				sessionData.lastCmd = rootCommand;
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
		//console.log(`\n   '${rootCommand}' is not recognized as a command. For a list of valid commands, type 'commands'.\n`);
		console.log();
		util.echo(`'${rootCommand}' is not recognized as a command. For a list of valid commands, type 'commands'.`);
		console.log();
		sessionData.linesSince++;
	}

	sessionData.cycle++;

	run();
}

run();