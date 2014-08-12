#!/usr/bin/env node

'use strict';

// set NODE_PATH for children.
process.env.NODE_PATH = '.';

var log = require('winston'),
  yargs = require('yargs'),
  Supervisor = require('./lib/supervisor');


// arguments to the program
var args = yargs.usage(
    'Launch Firebase worker tasks.\n' +
    'Usage: $0 [paths to workers]\n'
  )
  .describe('r', 'Run specified worker[s] only.')
  .alias('r', 'run')
  .default('r', 'all')
  .example('leiter -r task1 -r task2 path/to/tasks', 'Run only task1 and task2')
  .example(
    'leiter -r taskA:5 -r taskB:9 path/to/tasks',
    'Run 5 processes of task1 and 9 processes of task2')
  .describe('n', 'For any worker not specified otherwise, use N processes.')
  .alias('n', 'worker-count')
  .default('n', 1)
  .describe('z', 'Don\'t shut down stalled processes.')
  .alias('z', 'allow-zombies')
  .describe('t', 'Time in seconds before an unresponsive process is marked stalled.')
  .alias('t', 'time-to-zombie')
  .default('t', 10)
  .describe('o', 'Restart workers that exit with non-zero status codes.')
  .alias('o', 'restartCrashedWorkers')
  .describe('w', 'Launch the web monitor.')
  .alias('w', 'web-monitor')
  .describe('p', 'Run the web monitor on the specified port.')
  .alias('p', 'web-monitor-port')
  .default('p', 3031)
  .describe('e', 'Pass environment variable to a worker process.')
  .alias('e', 'env')
  .example('leiter -r taskA:5 -r taskB:9 -e FOO=BAR -e taskB:BAZ=QUUX', '')
  .check(function(argv) {

    if (argv._.length === 0) {
      throw new Error('Task not specified.');
    }

  })
  .argv;

// the unnamed argument list are the search paths
args.paths = args._;

// coerce args.run to an array
if (!Array.isArray(args.run)) {
  args.run = [args.run];
}

// setup logging
log.remove(log.transports.Console);
log.add(log.transports.Console, {
  colorize: true,
  timestamp: true,
  level: 'debug'
});

var supervisor = new Supervisor(args);
