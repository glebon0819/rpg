const readline = require('readline');
const fs = require('fs');

var sessionData = {
	// keeps track of how many lines the user has entered
	'cycle' : 0,
	// keeps track of the last actual command to be entered
	'lastCmd' : '',
	// tracks the number of lines entered since the last command
	'linesSince' : 0,
	'mode' : 'start'
};

var userData = {};

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

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

// function that loads the library files


// maps commands to functions and includes data about commands
var commandMap = {

	// creates a new game profile
	'new' : {
		// expected number of additional inputs
		'expIn' : 1,
		// messages to give before the extra inputs
		'mess' : {
			0 : '\n   % What\'s your name?\n'
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
								qty : 1,
								type : 'potion'
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
	'adv' : {
		'func' : function(cmd){
			console.log('\n   You\'re now on an adventure.\n');
		}
	},
	'drink' : {
		'func' : function(cmd){
			console.log('\n   You drink a potion. HP: (100/100)\n');
		}
	},
	'eat' : {
		'func' : function(cmd){
			console.log('\n   You eat an apple. HP: (100/100)\n');
		}
	},
	// shows the user a list of the items in their inventory
	'inventory' : {
		'func' : function(cmd){

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
	},
	'birth' : {
		'expIn' : 3,
		'mess' : {
			0 : 'what is your babys name?',
			1 : 'how much does it weigh?',
			2 : 'how long is it?'
		},
		'func' : function(cmd){

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
				console.log(`\n   % '${root_command}' is not recognized as a command. For a list of valid commands, type 'commands'.\n`);
			}
			else{
				console.log('\n   % Unknown error encountered.\n');
			}
			sessionData.linesSince++;
		}

		sessionData.cycle++;

		run();
	});
}

run();