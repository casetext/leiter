
'use strict';

var cluster = require('cluster')
  , log = require('winston');

module.exports = function(Supervisor) {

  Supervisor.prototype._launchMasterProcess = function() {

    // we don't pipe stdout/stderr direct to the cluster master
    cluster.setupMaster({ silent: true });

    // register exit listener
    cluster.on('exit', function(worker, code, signal) {

      if (code === null) {
        code = signal;
      }

      var message = worker._leiter.name +
        ' (pid ' + worker.process.pid + ') ' +
        ' exited at ' + new Date().toString() +
        ' with code ' + code;

      if (code === 0 || code === 143) {

        // code 143 is a default SIGTERM response. We treat that as a
        // normal termination, not a crash.
        log.info(message);
        this.emit('worker:exit', worker, code);

      } else {

        log.error(message);
        this.emit('worker:crash', worker, code);

        if (this.opts.restartCrashedWorkers) {

          var newRestartTime = worker._leiter.restartTime * 2;
          log.info(
            'restarting crashed worker',
            worker._leiter.name,
            'in',
            newRestartTime,
            'seconds...'
          );

          setTimeout(function() {
            this._startWorker(worker._leiter.name, newRestartTime);
          }.bind(this), newRestartTime * 1000);

        }

      }

      // when we're waiting for exit and no workers are left, we're done
      if (Object.keys(cluster.workers).length === 0 && this.gotQuitSignal) {

        // run this in a short timeout to give all pending log messages
        // a chance to flush
        setTimeout(function() {
          log.info('Leiter terminated voluntarily at', (new Date()).toString());
          process.exit(0);
        }, 100);

      }

    }.bind(this));

    // handle shutdown gracefully
    var quit = function() {

      Supervisor.allWorkers().forEach(function(worker) {

        worker.send({
          type: 'shutdown',
          force: this.gotQuitSignal
        });

      }.bind(this));

      if (this.gotQuitSignal) {
        log.info('Leiter terminated forcibly at', (new Date()).toString());
        process.exit(1);
      } else {
        log.info('Shutting down...');
        this.gotQuitSignal = true;
      }

    }.bind(this);

    process.on('SIGINT', quit);
    process.on('SIGTERM', quit);
    process.on('SIGQUIT', quit);

    // fork out for workers now
    Object.keys(this.workerFiles).forEach(function(workerFile) {

      // start the worker if we're running all workers or if it was
      // explicitly specified
      if (this.opts.run.indexOf('all') !== -1 ||
        this.opts.run.indexOf(workerFile) !== -1) {
        this._startWorker(workerFile);
      }

    }.bind(this));

  };

};
