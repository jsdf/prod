var health = require('health-monitor');
var exec = require('child_process').exec;

var config = require('./config.json');

var urlsApps = {};
config.apps.forEach(function(app) { urlsApps[app.url] = app.name; });

var prodInProgress = {};
Object.keys(urlsApps).forEach(function(url) { prodInProgress[url] = false; });

health.monitor(Object.keys(urlsApps), config.opts, function(err, url) {
  var name = urlsApps[url];

  if (!err) return config.verbose && log(name+' -- ok'); // all good
  if (prodInProgress[url]) return log(name+' -- prod in progress, skipping');

  prodInProgress[url] = true;
  function done() { prodInProgress[url] = false; }

  log(name+' -- healthcheck failed');
  checkProcessStatus(function(err, normal) {
    if (err) return logErr(err), done();
    if (!normal) return log(name+' -- process not in normal state, skipping'), done();

    log(name+' -- attempting to restart');
    restartProcess(name, function(err) {
      if (err) logErr(name+' -- error while trying to restart'), logErr(err), done();
      log(name+' -- restarted'), done();
    });
  });
});

function checkProcessStatus(done) {
  exec('pm2 jlist', {maxBuffer: 1024*1024}, function(err, stdout, stderr) {
    if (err) return done(err);

    try {
      var processesInfos = JSON.parse(stdout.toString());
    } catch (jsonErr) {
      if (jsonErr) return done(jsonErr);
    }
    var processInfo = processesInfos.find(function(info) { return info.name == name });
    if (!processInfo) return done(new Error('process not found in pm2 output'));
    if (!processInfo.pm2_env) return done(new Error('pm2 output invalid'));

    return done(null, processInfo.pm2_env.status === 'online');
  });
}

function restartProcess(name, done) {
  exec('pm2 restart '+name, done);
}

function log(msg) {
  console.log(new Date(), msg);
}

function logErr(err) {
  console.error(new Date(), err && err.stack || err);
}
