
/*
 * A fake worker.
 * It just logs an event every 5 seconds.
 */

'use strict';

var emitter = new require('events').EventEmitter();

exports.description = 'a fake worker.';
exports.emitter = emitter;
exports.shutDown = function() {

  console.log('shutting down');
  process.exit(0);

};

setInterval(function() {
  console.log('HI THERE');
}, 500);
