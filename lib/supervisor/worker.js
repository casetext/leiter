
'use strict';

var cluster = require('cluster')
  , log = require('winston')
  , usage = require('usage');

module.exports = function(Supervisor) {

  Supervisor.prototype._launchWorkerProcess = function() {

    var workerModule;

    // SIGINT is a no-op. Workers ignore it.
    process.on('SIGINT', function() {});

    // set process title for ps, top, and such
    process.title = 'leiter ' + process.env.WORKER_NAME;

    // handle messages from master
    cluster.worker.on('message', function(message) {

      if (message.type === 'ping') {

        usage.lookup(process.pid, { keepHistory: true }, function(err, result) {

          process.send({
            type: 'pong',
            cpu: result.cpu,
            memory: result.memory,
            uptime: process.uptime()
          });

        });

      } else if (message.type === 'shutdown') {

        if (workerModule.shutDown) {

          // a custom shutdown handler is registered, call it
          workerModule.shutDown(message.force);

        } else {

          // no custom shutdown, just send SIGTERM
          cluster.worker.kill();

        }

      }

    });

    // actually run the damn code
    workerModule = require(process.env.WORKER_PATH);

  };


  Supervisor.prototype._startWorker = function(workerName, restartTime) {

    var workerPath = this.workerFiles[workerName]
      , workerCount = this.workerProcessCounts[workerName] || this.opts.workerCount;

    for (var i = 0; i < workerCount; i++) {

      var worker = cluster.fork({
        'WORKER_NAME': workerName,
        'WORKER_PATH': workerPath
      });

      worker._leiter = {
        name: workerName,
        path: workerPath,
        restartTime: restartTime || 1,
        stalled: false,
        missedPingStreak: 0,
        lastPing: {}
      };

      this._handleWorker(worker);
      this.emit('worker:start', worker);

    }

  };


  Supervisor.prototype._handleWorker = function(worker) {

    worker.on('message', function(message) {

      if (message.type === 'pong') {

        delete message.type;

        worker._leiter.stalled = false;
        worker._leiter.missedPingStreak = 0;
        this.emit('worker:ping', worker, message);
        worker._leiter.lastPing = message;
        log.debug('got pong from', worker._leiter.name);

      }

    }.bind(this));

    worker.process.stdout.on('data', function(data) {
      log.info(worker._leiter.name, ':', data.toString());
      this.emit('worker:info', worker, data.toString());
    }.bind(this));

    worker.process.stderr.on('data', function(data) {
      log.error(worker._leiter.name, ':', data.toString());
      this.emit('worker:error', worker, data.toString());
    }.bind(this));

    // register pinger
    worker._leiter.pingerId = setInterval(function() {

      // the pinger should shut down if we're trying to quit
      if (this.gotQuitSignal || worker.state === 'dead') {
        clearInterval(worker._leiter.pingerId);
      } else {

        if (worker._leiter.pinged) {

          // worker didn't respond to the prior ping. might be stalled
          worker._leiter.missedPingStreak++;
          if (worker._leiter.missedPingStreak >= (this.opts.timeToZombie || 10)) {

            worker._leiter.stalled = true;
            this.emit('worker:zombie', worker, worker._leiter.missedPingStreak);

            // if we don't allow zombies, terminate the stalled thread
            if (!this.opts.allowZombies) {
              log.error(worker._leiter.name, '(pid ' + worker.process.pid +
                ') appears to have become a zombie. Terminating...');
              worker.kill('SIGKILL');
            }

          }

        }

        // send the ping
        worker.send({
          type: 'ping'
        });

        worker._leiter.pinged = true;

      }

    }.bind(this), 1000);

  };

};
