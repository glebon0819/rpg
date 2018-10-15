const fs = require('fs');
const util = require('./util');
const inv = require('./inv');

var userData = {};
var items = {};
var config = {};

exports.setUserData = function(data){
	userData = data;
}
exports.setItems = function(data){
	items = data;
}
exports.setConfig = function(data){
	config = data;
}

function levelUp(levels, ech){
	if(Number.isInteger(levels) && levels > 0){
		if((userData.gen.lvl + levels) <= config.levels.LEVEL_CAP){
			userData.gen.lvl += levels;
		}
		else{
			userData.gen.lvl = config.levels.LEVEL_CAP;
		}
		userData.gen.exp = 0;

		if(ech === true || ech === undefined){
			console.log();
			util.echo(`You leveled up! You are now level ${userData.gen.lvl}.`);
			console.log();
		}
	}
	else{
		throw '\'levelUp\' expects an int input, none supplied.';
	}
}

// returns number of milliseconds that should elapse between AP points being regenerated
function getApIncrement(){
	// default value for now
	// eventually this value will be affected by the user's stats
	return 3000;
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

// adds a number to AP (including negatives)
// if AP is > max, sets AP to max; if AP < 0, sets AP to 0
exports.changeAp = function(val, ech){
	userData.gen.ap += val;
	if(userData.gen.ap >= userData.gen.apm){
		userData.gen.ap = userData.gen.apm;
	}
	else if(userData.gen.ap < 0){
		userData.gen.ap = 0;
	}

	if(ech === true){
		console.log(`   ${(val > 0 ? '+' : '-')}  AP: (${userData.gen.hp}/${userData.gen.hpm}).\n`);
	}

	// set the last time AP was changed to now
	userData.gen.apc = util.getTimestamp(true);

	//console.log(`   ${(val > 0 ? '+' : '-')}  AP: (${userData.gen.ap}/${userData.gen.apm}).\n`);
}

exports.changeHp = function(val){
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
		//die();
	}
}

// gets AP back up to where it is supposed to be (according to the increment and how many milliseconds have elapsed)
exports.fixAp = function(){
	if(userData.gen.ap < userData.gen.apm){
		var lastTime = new Date(userData.gen.apc);
		var currentTime = new Date(util.getTimestamp(true));
		if((currentTime - lastTime) >= getApIncrement()){
			module.exports.changeAp(Math.floor((currentTime - lastTime) / getApIncrement()));
		}
	}
}

// removes item from inventory and applies its buffs and effects
exports.consume = function(itm){
	// get id of item from inventory and use it to access item's description in encyclopedia
	//var id = userData.inv[itm];
	var id = inv.isInInv(itm);

	if(id !== false){

		/*var itemBuffs = items[id].buffs;
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
		}*/

		inv.remFromInv(id, 1);

		var effects = items[id].effects;
		for(var effect in effects){
			if(effect == 'hp'){
				module.exports.changeHp(effects[effect]);
			}
			else if(effect == 'ap'){
				module.exports.changeAp(effects[effect], true);
			}
		}

	}
}

// checks if AP is above or equal to a given value
exports.checkAp = function(num){
	module.exports.fixAp();

	return (userData.gen.ap >= num ? true : false);
}

exports.gainXp = function(xp){
	var currentLvl = userData.gen.lvl;
	var currentXp = userData.gen.exp;
	var currentXpCap = config.levels[currentLvl].XP_CAP;

	console.log(`lvl: ${currentLvl}, xp: ${currentXp}, xpCap: ${currentXpCap}`);

	if(Number.isInteger(xp) && xp > 0){
		if((currentXp + xp) < currentXpCap){
			userData.gen.exp = currentXp + xp;
		}
		else{
			var newLvl = currentLvl++;
			var newXp = xp - (currentXpCap - currentXp);
			var newXpCap = config.levels[newLvl].XP_CAP;

			if(newXp < newXpCap){
				levelUp(1, true);

			}
			else{
				levelUp(1, false);
			}

			if(newXp > 0){
				module.exports.gainXp(newXp);
			}
		}
	}
	else{
		throw 'Players cannot gain negative XP.';
	}
}

exports.eat = function(cmd){
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
					module.exports.consume(itm);
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

exports.drink = function(cmd){
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
					module.exports.consume(itm);
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