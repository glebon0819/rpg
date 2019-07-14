const readlineSync = require('readline-sync')
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

exports.drop = function(cmd){
	cmd.shift();
	var item = cmd.join(' ');
	var id = module.exports.itmExists(item);

	if(item.length > 0){
		if(id !== false){
			module.exports.remFromInv(id, 1)
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

exports.inventory = function(cmd){
	if(Object.keys(userData.inv).length > 0){
		console.log(`\n ========================================================\n   ${userData.gen.nam}'s Inventory\n --------------------------------------------------------\n`)
		var itms = Object.keys(userData.inv);
		itms.forEach(item => {
			console.log('   ' + userData.inv[item].qty + ` x ${(module.exports.hasNewName(item) !== false ? module.exports.hasNewName(item) : items[item].nam)}`);
		});
		console.log('\n ========================================================\n');
	}
	else{
		console.log('\n   Your inventory is empty.\n');
	}
}

exports.equipment = function(cmd){
	console.log();
	for(var slot in userData.equipment){
		console.log(`   ${slot}:`);
		for(var itmId in userData.equipment[slot]){
			util.echo(`   +  ${userData.equipment[slot][itmId].qty} x ${(module.exports.hasNewName(itmId) !== false ? module.exports.hasNewName(itmId) : items[itmId].nam)}`);
		}
	}
	console.log();
}

exports.rename = function(cmd){
	cmd.shift();
	var itm = cmd.join(' ');

	// verify that the item they chose to rename exists
	var id = module.exports.itmExists(itm);
	if(id !== false){
		var newName = readlineSync.question(' New name: ');

		// verify that the new name is not already taken
		if(module.exports.itmExists(newName) === false){

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

exports.inspect = function(cmd){
	cmd.shift();
	var itm = cmd.join(' ');

	if(module.exports.isInEqp(itm) !== false || module.exports.isInInv(itm) !== false){
		var qty = 0;
		var id = module.exports.itmExists(itm);

		if(module.exports.isInEqp(itm) !== false){
			qty = userData.equipment[isInEqp(itm)][itm].qty;
		}
		if(module.exports.isInInv(itm)){
			qty += userData.inv[id].qty;
		}

		var properties = items[id];

		console.log(`\n   +  Quantity: ${qty}`);

		console.log(`   +  Type: ${properties.typ}`);

		console.log(`   +  Value: ${properties.val}`);

		if(properties.typ == 'food' || properties.typ == 'beverage' || properties.typ == 'potion'){
			if(properties.effects !== undefined){
				console.log('   +  Effects:');
				if(properties.effects.hp !== undefined){
					console.log(`      ${properties.effects.hp > 0 ? '+' : '-'}  ${Math.abs(properties.effects.hp)} HP`);
				}
				//if(typeof properties.effects.ap !== undefined){
				if(properties.effects.ap !== undefined){
					console.log(`      ${properties.effects.ap > 0 ? '+' : '-'}  ${Math.abs(properties.effects.ap)} AP`);
				}
			}
		}

		if(properties.typ == 'weapon' || properties.typ == 'armor'){

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
		console.log('\n   That item could not be found in your inventory or equipment.\n');
	}
}