
'use strict';

var http = require('http'),
  express = require('express'),
  socketIO = require('socket.io'),
  jade = require('jade'),
  log = require('winston');


function getWorkerInfo(worker, extended) {

  var info = {
    pid: worker.process.pid,
    name: worker._leiter.name,
    taskPath: worker._leiter.path,
    cpu: worker._leiter.lastPing.cpu || 0,
    memory: worker._leiter.lastPing.memory || 0,
    uptime: worker._leiter.lastPing.uptime || 0,
  };

  if (extended === true) {
    info.logHistory = worker.logHistory;
  }

  return info;
}


module.exports = function(supervisor) {

  // launch monitoring web server
  var app = express()
    , server = http.Server(app)
    , ioServer = socketIO(server);

  app.set('views', process.cwd() + '/server');
  app.engine('jade', jade.__express);

  app.get('/', function(req, res) {
    res.render('index.jade');
  });

  app.use('/static/css', express.static('server/static/css'));
  app.use('/static/js', express.static('server/static/js'));

  app.use(
    '/static/bootstrap',
    express.static('node_modules/bootstrap/dist'));

  app.use(
    '/static/socket.io',
    express.static('node_modules/socket.io-client'));

  var port = process.env.PORT || 3031;
  log.info('Web server started on port', port);
  server.listen(port);


  // hand over all worker info on connection
  ioServer.on('connection', function(socket) {

    Object.keys(supervisor.workers).forEach(function(workerId) {

      var worker = supervisor.workers[workerId];
      socket.emit('ok', getWorkerInfo(worker, true));

    });

    socket.on('restart', function(workerId) {
      var worker = supervisor.workers[workerId];
      supervisor.stop(workerId, function() {
        supervisor.launch(worker.taskName);
      });
    });

  });


  ['worker:exit', 'worker:crash'].forEach(function(msgType) {

    supervisor.on(msgType, function(worker, code) {
      ioServer.emit(msgType, code);
    });

  });

  ['worker:start', 'worker:ping', 'worker:zombie'].forEach(function(msgType) {

    supervisor.on(msgType, function(worker) {
      ioServer.emit(msgType, getWorkerInfo(worker));
    });

  });

  ['worker:info', 'worker:error'].forEach(function(ioType) {

    supervisor.on(ioType, function(worker, text) {
      ioServer.emit(ioType, getWorkerInfo(worker), text);
    });

  });

};
