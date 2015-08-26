'use strict';

/* global require, exports, dump */
var utils = require('utils');

function removeFiles (list) {
  list.forEach((file) => {
    utils.log('PREPROCESSOR', 'remove file:', file.path);
    if (utils.fileExists(file.path)) {
      file.remove(false);
    }
  });
}

function processHtmlContent(flag, enable, content) {
  var replaced;
  if (enable) {
    replaced = content.
      replace('<!--IFDEF_' + flag, '', 'g').
      replace('ENDIF_' + flag + '-->', '', 'g');
  } else {
    var regexp = new RegExp(
      '<!--IFDEF_' + flag + '[^]*?ENDIF_' + flag + '-->',
      'mg'
    );
    replaced = content.replace(regexp, '');
    //replaced = content.
    //  replace(/<!--IFDEF_FIREFOX_SYNC[^]*?ENDIF_FIREFOX_SYNC-->/mg, '');
  }

  return replaced;
}

function processHtmlFiles (flag, enable, list) {
  list.forEach((file) => {
    var fileContent = utils.getFileContent(file);
    var replacedContent = processHtmlContent(flag, enable, fileContent);
    utils.writeContent(file, replacedContent);
  });
}

exports.execute = function (flag, enable, list) {
  processHtmlFiles(flag, enable, list.modification.html);
  if (enable) {
    if (list && list.enable && list.enable.remove) {
      removeFiles(list.enable.remove);
    }
  } else {
    if (list && list.disable && list.disable.remove) {
      removeFiles(list.disable.remove);
    }
  }
};
