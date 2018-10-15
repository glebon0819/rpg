const util = require('./util.js');

var userData = {};
var config = {};

function levelUp(levels, alert){
	if(Number.isInteger(levels) && levels > 0){
		if((userData.gen.lvl + levels) <= config.levels.LEVEL_CAP){
			userData.gen.lvl += levels;
		}
		else{
			userData.gen.lvl = config.levels.LEVEL_CAP;
		}
		userData.gen.exp = 0;

		if(alert === true || alert === undefined){
			console.log();
			util.echo(`You leveled up! You are now level ${userData.gen.lvl}.`);
			console.log();
		}
	}
	else{
		throw '\'levelUp\' expects an int input, none supplied.';
	}
}

exports.setUserData = function(data){
	userData = data;
}
exports.setConfig = function(data){
	config = data;
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