var health = require('health-monitor');
var exec = require('child_process').exec;
var _ = require('underscore');

var config = require('./config.json');

var urlsApps = {};
_.each(config.apps, function(app) { urlsApps[app.url] = app.name });

var prodInProgress = {};
_.each(urlsApps, function(val, key) { prodInProgress[key] = false });

health.monitor(_.keys(urlsApps), config.opts, function(err, url) {
  if (!err) return; // all good

  var name = urlsApps[url];

  prodInProgress[url] = true;
  var done = function() { prodInProgress[url] = false; }

  log(name+' -- healthcheck failed');
  exec('pm2 jlist', { maxBuffer: 1024*1024 }, function(err, stdout, stderr) {
    if (err) return logErr(err) && done();

    var processesInfos = JSON.parse(stdout.toString());
    var processInfo = _.find(processesInfos, {name: name})
    if (!(processInfo && processInfo.pm2_env)) return done();
    if (processInfo.pm2_env.status != 'online') return done();

    log(name+' -- attempting to restart');
    exec('pm2 restart '+name, function(err) {
      if (err) {
        logErr(name+' -- error while trying to restart');
        logErr(err);
      } else {
        log(name+' -- restarted');
      }
      return done();
    }
  });
});

function log(msg) {
  console.log(new Date(), msg);
}

function logErr(err) {
  console.error(new Date(), err && err.stack || err);
}
