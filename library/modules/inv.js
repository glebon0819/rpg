var userData = {};
var items = {};

exports.setUserData = function(data){
	userData = data;
}
exports.setItems = function(itms){
	items = itms;
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
		//console.log(`\n   ${qty} x '${items[num].nam}' added to inventory.\n`);
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
	Object.keys(userData.inv).forEach(item => {
		if(itm.toLowerCase() == items[item].nam.toLowerCase()){
			isInInv = item;
		}
	});
	return isInInv;
}