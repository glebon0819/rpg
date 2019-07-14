const readlineSync = require('readline-sync');
const util = require('./util.js');

var userData = {};
var locations = {};

exports.setUserData = function(data){
	userData = data;
}
exports.setLocations = function(data){
	locations = data;
}
// checks if a province exists
function isProvince(prv){
	return locations.hasOwnProperty(prv);
}

// checks if a location exists within a province
function isLocation(loc, prv){
	return locations[prv].loc.hasOwnProperty(loc);
}

exports.location = function(cmd){
	cmd.shift();

	if(cmd != '++'){
		console.log();
		util.echo(`${userData.location.loc}, ${userData.location.prv} Province`);
		console.log();

		if(cmd == '+'){
			util.echo(`Fishing: ${locations[userData.location.prv].loc[userData.location.loc].fsh !== false ? 'Yes' : 'No'}`);
			util.echo(`Mining: ${locations[userData.location.prv].loc[userData.location.loc].min !== false ? 'Yes' : 'No'}`);
			util.echo(`Foraging: ${locations[userData.location.prv].loc[userData.location.loc].fge !== false ? 'Yes' : 'No'}`);
			util.echo(`Chopping: ${locations[userData.location.prv].loc[userData.location.loc].chp !== false ? 'Yes' : 'No'}`);
			console.log();
		}
	}
	else{
		var province = readlineSync.question(' Province: ');

		if(isProvince(province)){
			var location = readlineSync.question(' Location: ');
			if(isLocation(location, province)){
				console.log();
				util.echo(`${location}, ${province} Province`);
				console.log();
				util.echo(`Fishing: ${locations[province].loc[location].fsh !== false ? 'Yes' : 'No'}`);
				util.echo(`Mining: ${locations[province].loc[location].min !== false ? 'Yes' : 'No'}`);
				util.echo(`Foraging: ${locations[province].loc[location].frg !== false ? 'Yes' : 'No'}`);
				util.echo(`Chopping: ${locations[province].loc[location].chp !== false ? 'Yes' : 'No'}`);
				console.log();
			}
		}
		else{
			console.log('\n   That is not a province.\n');
		}
	}
}
exports.travel = function(cmd){
	cmd.shift();
	var destPrv = userData.location.prv;

	// if argument supplied, change province
	if(cmd == '+') {
		destPrv = readlineSync.question(' Province: ');
	}
	if(isProvince(destPrv)){
		var destLoc = readlineSync.question(` Location within ${destPrv}: `);
		if(isLocation(destLoc, destPrv)){
			userData.location.prv = destPrv;
			userData.location.loc = destLoc;
			console.log('\n   Traveled.\n');
		}
		else{
			console.log('\n   That location does not exist within that province.\n');
		}
	}
	else{
		console.log('\n   That province does not exist.\n');
	}
}