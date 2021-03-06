
"use strict";

let console = require('console');
let fs = require('fs');
let path = require('path');
let process = require('process');
let cProcess = require('child_process');
let util = require('util');

let ejs = require('ejs');

let csp = require('./callSiteProcessing');

//
let nodePath = __dirname + path.sep + 'bins' + path.sep;
//let nodePath = "C:\\Chakra\\TTNode\\Debug\\";

let outputhtml = undefined;
//

let siteejs = fs.readFileSync(__dirname + '/views/site.ejs', { encoding: 'utf8' });
let cpathejs = fs.readFileSync(__dirname + '/views/cpath.ejs', { encoding: 'utf8' });

function loadAllocationInfo(data) {
    let spos = data.indexOf('[');
    let epos = data.lastIndexOf(']') + 1;
    let dstr = data.substring(spos, epos).replace(/\\/g, '\\\\');

    // console.log(dstr);

    processAllocationInfo(JSON.parse(dstr));
}

function renderCallSiteTree(mobj, hasUseFlags) {
    if (mobj.site) {
        return ejs.render(siteejs, { data: mobj });
    }
    else {
        let subtrees = [];
        mobj.callPaths.forEach(function (cmobj) {
            subtrees.push(renderCallSiteTree(cmobj, false));
        });

        return ejs.render(cpathejs, { info: mobj, subtrees: subtrees, useflags: hasUseFlags });
    }
}

function isInterestingSizeCheck(liveCount, liveSize, totalCount, totalSize) {
    let countOk = (liveCount / totalCount) > 0.05;
    let sizeOk = (liveSize / totalSize) > 0.05;

    return countOk || sizeOk;
}

function processAllocationInfo(allocInfo) {
    let userAllocInfo = [];

    console.log('Filtering interesting allocation sites...');
    allocInfo.forEach(function (mobj) {
        let scc = csp.stdFilterMemoryObject(mobj, false);
        if (scc) {
            userAllocInfo.push(scc);
        }
    });
    console.log("Found " + userAllocInfo.length + " user relevant allocation sites.")

    let totalMem = userAllocInfo.reduce(function (acc, val) {
        return acc + csp.computeTotalMemoryUse(val);
    }, 0);

    let totalCount = userAllocInfo.reduce(function (acc, val) {
        return acc + csp.computeTotalLiveCount(val);
    }, 0);

    console.log('Filtering allocation sites with large memory/object counts...');
    let allocHtml = [];
    userAllocInfo.forEach(function (mobj) {
        let process = true;
        if (mobj.site) {
            process = isInterestingSizeCheck(mobj.site.liveCount, mobj.site.liveSize, totalCount, totalMem);
        }
        else {
            process = isInterestingSizeCheck(mobj.liveCount, mobj.liveSize, totalCount, totalMem);
        }

        if (process) {
            let hasUseFlags = csp.checkForUseFlags(mobj);
            allocHtml.push(renderCallSiteTree(mobj, hasUseFlags));
        }
    });
    console.log("Found " + allocHtml.length + " interesting allocation sites.")

    console.log('Generating html...');
    ejs.renderFile(__dirname + '/views/index.ejs', { allocs: allocHtml }, { cache: false }, function (err, res) {
        if (err) {
            console.log("Error in render: " + err.toString());
            return;
        }

        console.log('Writing html to ' + outputhtml);
        fs.writeFileSync(outputhtml, res);

        console.log('Done.');
    });
}

function executeReplayAndProcess(traceFile,  htmloutput) {
    outputhtml = htmloutput;
    
    console.log('Replaying ' + traceFile + ' with analytics...')

    let bindir = undefined;
    let binpath = undefined;
    if(process.platform === 'win32') {
        binpath = nodePath + 'win32_bins' + path.sep + 'node.exe';
    }
    else if(process.platform === 'darwin') {
        binpath = nodePath + 'macOS_bins' + path.sep + 'node';
    }
    else if(process.platform === 'linux') {
        binpath = nodePath + 'linux_bins' + path.sep + 'node';
    }
    else {
        console.log('Unknown platform in executeReplay');
        process.exit(1);
    }

    if (!fs.existsSync(binpath))
    {
	console.log('Node binary not found...exiting');
	console.log('Hint: uncompress the binary in your bin/{platform}');
    }
    
    let args = ['--nolazy', '--replay=' + traceFile];
    
    let cproc = cProcess.spawn(binpath, args);

    cproc.on('error', function (err) {
        console.log('Replaying tracefile failed: ' + err);
        process.exit(1);
    });

    let stdoutResult = '';
    cproc.stdout.on('data', function (data) {
        stdoutResult += data;
    });

    cproc.on('close', function (code) {
        loadAllocationInfo(stdoutResult);
    });


}

//fs.readFile(dataFile, 'utf8', loadAllocationInfo);

//
//TODO read parameters from command line
//
let tracedir = process.argv[2];
executeReplayAndProcess(tracedir, __dirname + path.sep + 'alloc.html');
