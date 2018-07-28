const fs = require('fs');

module.exports = {
  commandMap: {
    'adv' : function() {
    	console.log('\n   % You\'re now on an adventure.\n');
    },
    'drink' : function(){
    	console.log('\n   % You drink a potion.\n');
    },
    'eat' : function(){
    	console.log('\n   % You eat an apple.\n');
    }
  }
};