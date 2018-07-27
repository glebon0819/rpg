const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var cycle = 0;

function run(){
	if(cycle < 1){
		console.log('\n!=============== [Welcome to Test RPG!] ===============!\n\nEnter a command to continue...\n\n!======================================================!');
	}
	rl.question('\n', (answer1) => {
		console.log('You said: "' + answer1 + '"');

		
		
		if(answer1 == 'stop'){
			rl.close();
			console.log('rl closed');
			return;
		}

		cycle++;

		run();
	});
}

run();