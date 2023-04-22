const fs = require('fs');
const cluster = require('cluster');

const config = require('./src/config');
const processFile = require('./src/processFile');

// uses forked processes to handle processing files in parallel.
if (cluster.isMaster) {
  console.log('Starting with options...');
  console.log('layers:', config.layers.join(','));
  console.log('threshold:', config.threshold);
  console.log('simplify:', config.simplify);
  console.log('parallelism:', config.parallel);
  const startTime = Date.now();

  // create output folders
  fs.mkdirSync('./output/sieve', { recursive: true });
  fs.mkdirSync('./output/geojson', { recursive: true });

  // files is a queue of the remaining files to be processed
  const files = fs.readdirSync('./data').map((f) => `./data/${f}`);
  const total = files.length;

  // fork a worker process for configured parallelism
  let workers = 0;
  let completed = 0;
  let failed = [];

  for (let i = 0; i < config.parallel; i++) {
    const worker = cluster.fork();
    workers++;

    // set max number of event handlers
    worker.setMaxListeners(config.parallel);

    // process file on worker
    worker.send(files.shift());

    // send worker another file when done
    worker.on('message', (msg) => {
      if (msg === 'done') {
        completed++;
      } else {
        failed.push(msg);
      }

      if (files.length > 0) {
        const file = files.shift();
        if (config.debug) {
          console.log(`worker ${worker.process.pid} starting file ${file}`);
        }
        worker.send(file);
      } else {
        console.log(`shutting down worker ${worker.process.pid}`);
        worker.send('shutdown');
      }
    });
  }

  // log progress every 10s (only if it has changed)
  let prevLog;
  setInterval(() => {
    const progress = Math.round((completed / total) * 100);
    let log = `Completed ${completed} of ${total} files. (${progress}%)`;
    if (config.debug) {
      log = `${log}. ${workers} workers remain.`;
    }
    if (log !== prevLog) {
      console.log(log);
      prevLog = log;
    }
  }, 1000 * 10);

  // child process exited
  cluster.on('exit', (worker) => {
    workers--;
    console.log(`Worker ${worker.process.pid} died. ${workers} remain.`);

    // if last worker, log info and shutdown
    if (workers === 0) {
      console.log('Done. Completed in', (Date.now() - startTime) / 1000, 'seconds');
      if (failed.length > 0) {
        console.log('The following files failed:');
        failed.forEach((file) => console.log('  ', file));
      }
      process.exit(0);
    }
  });


} else { // worker
  process.on('message', (msg) => {
    try {
      if (msg === 'shutdown') { // kill worker
        process.exit(0);
      }

      processFile(msg)
        .then(() => process.send('done'))
        .catch((err) => {
          console.log(err);
          process.send(msg);
        });

    } catch (err) {
      console.log('UNCAUGHT ERROR:', err);
      process.send(msg);
    }
  });
}
