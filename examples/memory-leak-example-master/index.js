"use strict";

var path = require('path');
var fsextra = require('fs-extra');
var process = require('process');

var memLimit = 10000000;
var memInc = 5000000;
function checkMem() {
  var cmem = process.memoryUsage().heapTotal;
  if (cmem > memLimit) {
    var mlstring = (memLimit / 1000000) + "MB"
    console.log('Total memory use exceeded current threshold -- ' + mlstring);

    if (global.emitTTDLog) {
      var leaklogdir = path.normalize(__dirname + path.sep + '_leakReport_' + mlstring + path.sep);
      fsextra.ensureDirSync(leaklogdir);
      console.log('Writing leak report to -- ' + leaklogdir);

      global.emitTTDLog(leaklogdir);
    }

    memLimit += memInc;
  }
}
setInterval(checkMem, 500);

var leakyData = [];
var nonLeakyData = [];

class SimpleClass {
  constructor(text) {
    this.text = text;
  }
}

function cleanUpData(dataStore, randomObject) {
  var objectIndex = dataStore.indexOf(randomObject);
  dataStore.splice(objectIndex, 1);
}

function getAndStoreRandomData() {
  var randomData = Math.random().toString();
  var randomObject = new SimpleClass(randomData);

  randomObject.spArray = [];
  randomObject.spArray[100] = 'sparse';

  randomObject.small = { onefield: 1 };

  leakyData.push(randomObject);
  nonLeakyData.push(randomObject);

  // cleanUpData(leakyData, randomObject); //<-- Forgot to clean up
  cleanUpData(nonLeakyData, randomObject);
}

function generateHeapDumpAndStats() {
  process.exit(1);
}

//Kick off the program
setInterval(getAndStoreRandomData, 5); //Add random data every 5 milliseconds
setInterval(generateHeapDumpAndStats, 5000); //Do garbage collection and heap dump every 2 seconds