'use strict';

/* jshint node: true */

var utils = require('utils');
var esomin = require('esomin');

function execute(options) {
  var appName = utils.basename(options.APP_DIR);
  var config = utils.getFile(options.APP_DIR, 'build',
    'require_config.jslike');
  var rjsPath = utils.joinPath(options.GAIA_DIR, 'build', 'r.js');
  var requirejs;

  if (utils.isNode()) {
    requirejs = require(rjsPath);
  } else {
    var sandbox = utils.createSandbox();
    sandbox.arguments = [];
    sandbox.requirejsAsLib = true;
    sandbox.print = function() {
      utils.log(appName, Array.prototype.join.call(arguments, ' '));
    };
    utils.runScriptInSandbox(rjsPath, sandbox);
    requirejs = sandbox.requirejs;
  }

  // logLevel set 4 for silent, set 0 for all
  var log = 'logLevel=' + (options.VERBOSE === '1' ? '0' : '4');
  var optimize = 'optimize=none';
  var build = new Promise(function(resolve, reject) {
    requirejs.optimize([config.path, optimize, log], resolve, reject);
  });

  return build
    .then(function() {
      utils.log(appName, 'require.js optimize done');
    })
    .then(function() {
      if (options.GAIA_OPTIMIZE === '1') {
        utils.log(appName, 'esomin minify done');
        return esomin.minifyDir(options.STAGE_APP_DIR);
      }
    })
    .catch(function(err) {
      utils.log(appName, 'running customize build failed');
      utils.log(appName, err);
    });
}

function copyUserConfig(options) {
  var targetDir = utils.joinPath(options.STAGE_APP_DIR, 'js', 'config');
  var filename = 'config.js';

  if (options.GAIA_DISTRIBUTION_DIR) {
    var distConfig = utils.getFile(options.GAIA_DISTRIBUTION_DIR,
      'camera-config.js');
    if (distConfig.exists()) {
      utils.copyFileTo(distConfig, targetDir, filename);
    }
  }
}

exports.execute = function(options) {
  copyUserConfig(options);
  return execute(options);
};
