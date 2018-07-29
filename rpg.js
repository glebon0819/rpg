const readline = require('readline');
const fs = require('fs');

var userData = {};
var items = {};
var monsters = {};

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

// function that loads the library files
function loadResources(){
	var encyclopedia = fs.readFileSync('./library/encyclopedia.json', 'utf8');
	items = JSON.parse(encyclopedia);
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
function addToInv(itm, num, qty){
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
		userData.inv[itm] = {og : num, qty : qty};
	}

	// print to screen message notifying player that an item was added to their inventory
	console.log(`\n   ${qty} x '${itm}' added to inventory.\n`);
}

// function that removes an item from player inventory
function remFromInv(itm, qty){

}

// function that checks if a cooldown is currently in effect, deletes old cooldowns
function checkCooldowns(cmd){
	// returns time left in seconds if there is active cooldown, false if not
}

// maps commands to functions and includes data about commands
var commandMap = {
	// creates a new game profile
	'new' : {
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
					var now = new Date();
					var dd = now.getDate();
					var mm = now.getMonth()+1;
					var yyyy = now.getFullYear();
					var hh = now.getHours();
					var mm2 = now.getMinutes();
					var ss = now.getSeconds();

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

					userData = {
						gen: {
							nam : username,
							dat : (dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mm2 + ':' + ss),
							dt2 : (dd + mm + yyyy + hh + mm2 + ss),
							lvl : 1,
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
							}
						},
						stats: {
							str : 0,
							int : 0,
							lck : 0
						}
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
		'func' : function(cmd){
			var profiles = getSaves();
			if(profiles.length == 0){
				console.log('\n   No save files were found.\n')
			}
			else {
				console.log('   We found the following save files on your disc:');
				profiles.forEach(profile => {
					console.log(`\n   +  Created on ${profile.date} ........ "${profile.name}"`);
				});
			}
		}
	},
	// loads user data from a save file
	'load' : {
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
					console.log(`\n   Welcome back, ${userData.gen.nam}!\n`)
				}
				else{
					console.log(`\n   Could not locate profile "${profileName}".\n`);
				}
			}
			else{
				console.log('\n   Load failed. No profile name provided.\n')
			}
		}
	},
	// deletes a save profile
	'delete' : {
		'func' : function(cmd){

		}
	},
	// barfs out a list of all of the commands
	'commands' : {
		'func' : function(cmd){
			console.log(`\n   Commands\n ========================================================\n`);
			var cmds = Object.keys(commandMap);
			cmds.forEach(cmd => {
				console.log(`   ${cmd}\n`);
			});
		}
	},
	// shows the user a list of the items in their inventory
	'inventory' : {
		'func' : function(cmd){
			console.log(`\n   ${userData.gen.nam}'s Inventory\n ========================================================\n`)
			var items = Object.keys(userData.inv);
			items.forEach(item => {
				console.log('   ' + userData.inv[item].qty + ` x ${item}\n`);
			});
		}
	},
	// shows the user what stats they have
	'stats' : {
		'func' : function(cmd){

		}
	},
	// used to assign points to different stats
	'assign' : {
		'func' : function(cmd){

		}
	},
	// can be used to consume beverages and potions
	'drink' : {
		'func' : function(cmd){
			console.log('\n   You drink a potion. HP: (100/100)\n');
		}
	},
	// can be used to consume food items
	'eat' : {
		'func' : function(cmd){
			console.log('\n   You eat an apple. HP: (100/100)\n');
		}
	},
	// continues your latest battle
	'adv' : {
		'func' : function(cmd){
			console.log('\n   You\'re now on an adventure.\n');
		}
	},
	// fishes in the local area, adding fish to your inventory
	'fish' : {
		'func' : function(cmd){
			// checks if any fishing cooldowns are in effect
			// if so, print that it is not ready yet with the time left
			// else add a fish to the player's inventory
			addToInv('Fish', 3, 1);

			// or maybe always check all functions for cooldowns before running them
		}
	},
	// chops down in the local area, adding fish to your inventory
	'chop' : {
		'func' : function(cmd){
			// checks if any chopping cooldowns are in effect
			// if so, print that it is not ready yet with the time left
			// else add a log to the player's inventory
			addToInv('Log', 2, 1);
		}
	},
	'mine' : {
		'func' : function(cmd){
			// checks if any mining cooldowns are in effect
			// if so, print that it is not ready yet with the time left
			// else add ore to the player's inventory
			addToInv('Iron Ore', 2, 1);
		}
	},
	// saves your user data to a JSON file in the 'saves' folder
	'save' : {
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
		'func' : function(cmd){
			rl.close();
			console.log('\n !======================================================!');
			process.exit(0);
		}
	}
};	

function run(){

	if(sessionData.cycle === 0){
		console.log('\n !=============== [Welcome to Test RPG!] ===============!\n');
		commandMap['profiles'].func('');
		console.log('\n   Use \'new\' followed by your desired username to start\n   a new game or \'load\' followed by the username of your\n   desired profile to load a previously saved game.\n')
		//console.log(getSaves());

	}

	rl.question(' ', (command) => {

		//check if last command's expected additional inputs have been met
		/*if(sessionData.linesSince < commandMap[sessionData.lastCmd].expIn){

		}*/

		var commands = command.split(' ');

		var root_command = commands[0];
		//commandMap[root_command].func(commands);
		try {
			commandMap[root_command].func(commands);
			sessionData.lastCmd = root_command;
		}
		catch(err){
			if(err instanceof TypeError){
				console.log(`\n   '${root_command}' is not recognized as a command. For a list of valid commands, type 'commands'.\n`);
			}
			else{
				console.log('\n   Unknown error encountered.\n');
			}
			sessionData.linesSince++;
		}

		sessionData.cycle++;

		run();
	});
}

run();