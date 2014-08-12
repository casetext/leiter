
'use strict';

var cluster = require('cluster')
  , fs = require('fs')
  , path = require('path')
  , util = require('util')
  , events = require('events');

util.inherits(Supervisor, events.EventEmitter);

function Supervisor(opts) {

  this.gotQuitSignal = false;
  this.opts = {};

  Object.keys(opts).forEach(function(key) {
    this.opts[key] = opts[key];
  }.bind(this));

  // process opts.run and get process counts
  this.workerProcessCounts = {};
  this.opts.run.forEach(function(workerName, index) {

    var bits = workerName.split(':');
    this.opts.run[index] = bits[0];

    if (bits.length === 2) {
      this.workerProcessCounts[bits[0]] = parseInt(bits[1]);
    }

  }.bind(this));

  // discover workers
  this.workerFiles = [];
  var paths = opts.paths.slice(0),
    nextPath;

  while ((nextPath = paths.pop())) {

    var info = fs.statSync(nextPath);
    if (info.isDirectory()) {

      // get all the files underneath
      paths = paths.concat(fs.readdirSync(nextPath).map(function(filename) {
        return path.join(nextPath, filename);
      }));

    } else if (info.isFile()) {

      // the path itself is for the worker
      var workerName = path.basename(nextPath).split('.').slice(0, -1).join('.');
      this.workerFiles[workerName] = nextPath;

    }

  }

  if (cluster.isMaster) {

    // this is the main process. hook up all triggers and fork workers.
    this._launchMasterProcess();

    // if web monitor was requested, launch that
    if (this.opts.webMonitor) {
      require('./monitor')(this);
    }

  } else {

    // worker process. instantiate the assigned worker code for this fork.
    this._launchWorkerProcess(cluster.worker);

  }

}


Supervisor.allWorkers = function() {

  return Object.keys(cluster.workers).map(function(key) {
    return cluster.workers[key];
  });

};

require('./supervisor/master')(Supervisor);
require('./supervisor/worker')(Supervisor);

module.exports = Supervisor;
