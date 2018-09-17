exports.getTimestamp = function(readable){
	var now = new Date();
	var dd = now.getDate();
	var mm = now.getMonth()+1;
	var yyyy = now.getFullYear();
	var hh = now.getHours();
	var mm2 = now.getMinutes();
	var ss = now.getSeconds();
	var mmm = now.getMilliseconds();

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
	if(mmm < 10){
		mmm = '00' + mmm;
	}
	else if(mmm < 100){
		mmm = '0' + mmm;
	}

	if(readable){
		timestamp = (yyyy + '-' + mm + '-' + dd + 'T' + hh + ':' + mm2 + ':' + ss + '.' + mmm + 'Z');
	}
	else{
		timestamp = (dd + mm + yyyy + hh + mm2 + ss + mmm);
	}
	return timestamp;
}

// logs strings to the console while maintaining the predefined character width of the game
exports.echo = function(string){
	var lastI = 0;
	var end;
	for(var i = 0; i < Math.ceil(string.length / 54); i++){
		var endFound = false;
		var char;
		end = lastI + 53;
		while(!endFound){
			if(end === lastI){
				endFound = true;
				end = lastI + 53;
			}
			else{
				char = string.charAt(end);
				if(char === ' ' || end === string.length){
					endFound = true;
				}
				else{
					end--;
				}
			}
		}
		console.log(`   ${string.substring(lastI, end).trim()}`);
		lastI = end;
	}
}

// returns the key to a random property of an input object where the values are the properties' probabilities of being picked
exports.randPick = function(object){

	var num = Math.random(),
        s = 0,
        res = null,
        found = false;

    Object.keys(object).forEach(function(element){
        s += parseFloat(object[element]);
        if (num < s && !found) {
        	res = element;
            found = true;
        }
    });

	return res;
}