const readline = require('readline');
const fs = require('fs');
const test = require('./test');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// keeps track of number of commands in a game
var cycle = 0;

function run(){
	
	if(cycle === 0){
		console.log('\n !=============== [Welcome to Test RPG!] ===============!\n\n   % Enter a command to continue...\n');
	}

	rl.question(' ', (command) => {

		var commands = command.split(' ');

		var root_command = commands[0];
		
		if(root_command == 'exit'){
			rl.close();
			console.log('\n !======================================================!');
			return;
		}
		else{
			try {
				test.commandMap[root_command]();
			}
			catch(err){
				console.log(`\n   % '${root_command}' is not recognized as a command. For a list of valid commands, type 'commands'.\n`);
			}
		}

		cycle++;

		run();
	});
}

run();