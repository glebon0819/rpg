const util = require('./util.js');

var userData = {};
var items = {};
config = {};

exports.setUserData = function(data){
	userData = data;
}
exports.setItems = function(data){
	items = data;
}
exports.setConfig = function(data){
	config = data;
}

// adds items to player's inventory
exports.addToInv = function(num, qty, ech){
	// get inventory items
	var inv = Object.keys(userData.inv);
	var match = false;
	// if item is in inventory increment qty, if not, add item
	inv.forEach(item => {
		if(num == item){
			match = true;
		}
	});

	if(match){
		userData.inv[num].qty = userData.inv[num].qty + qty;
	}else{
		userData.inv[num] = { qty : qty };
	}

	// prints to screen message notifying player that an item was added to their inventory if the echo condition is true
	if(ech === true){
		console.log();
		util.echo(`${qty} x '${items[num].nam}' added to inventory.`);
		console.log();
	}
}

// removes items from player inventory
exports.remFromInv = function(id, qty){
	if(userData.inv[id].qty > qty){
		userData.inv[id].qty -= qty;
	}
	else{
		delete userData.inv[id];
	}
}

// checks if an item exists in the encyclopedia, returns its ID number if so, false if not
exports.itmExists = function(itm){
	var exists = false;
	// check if item exists in the user's renames
	for(var rename in userData.renames){
		if(itm.toLowerCase() == userData.renames[rename]){
			exists = rename;
		}
	}
	// check if item exists in the encyclopedia
	for(var item in items){
		if(itm.toLowerCase() == items[item].nam.toLowerCase()){
			exists = item;
		}
	}
	return exists;
}

// returns whether an item is in the player's inventory; returns items id number if yes, false if no
exports.isInInv = function(itm){
	var isInInv = false;
	//console.log(userData.renames);
	for(var rename in userData.renames){
		if(itm.toLowerCase() == userData.renames[rename]){
			isInInv = rename;
		}
	}
	Object.keys(userData.inv).forEach(item => {
		if(itm.toLowerCase() == items[item].nam.toLowerCase()){
			isInInv = item;
		}
	});
	return isInInv;
}

// adds item to player's equipment, removing it from their inventory
exports.equip = function(og){
	// checks that the max number of items for this slot will not be surpassed
	var itemCount = 0;
	for(var item in userData.equipment[items[og].slt]){
		itemCount += userData.equipment[items[og].slt][item].qty;
	}

	//if(Object.keys(userData.equipment[items[og].slt]).length < config.equipment[items[og].slt].ITEM_COUNT_MAX){
	if(itemCount < config.equipment[items[og].slt].ITEM_COUNT_MAX){
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
		module.exports.remFromInv(og, 1);
	}
	else{
		throw `Number of items allowed in your ${items[og].slt} slot has been reached. Unequip an item in that slot to free up room.`;
	}
}

// removes an item from player's equipment, adding it to their inventory and removing any stat increases
exports.unequip = function(og){
	module.exports.addToInv(og, 1, false);

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
exports.isInEqp = function(itm){
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
exports.hasNewName = function(og){
	var newName = false;

	if(userData.renames[og] !== undefined){
		newName = userData.renames[og];
	}

	return newName;
}