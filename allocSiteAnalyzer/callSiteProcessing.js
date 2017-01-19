
"use strict";

//Compute the memory use for a mobj record
function computeTotalMemoryUse(mobj) {
    if(mobj.site) {
        return mobj.site.liveSize;
    }
    else {
        return mobj.callPaths.reduce(function (acc, val) {
            return acc + computeTotalMemoryUse(val);
        }, 0);
    }
}

//Filter a memory record tree to only callstacks that contain user code and have at least 2 live object
function stdFilterMemoryObject(mobj, usercodeDir, okpath) {
    if(mobj.site) {
        return ((okpath || mobj.src.file.startsWith(usercodeDir)) && mobj.site.liveSize !== 0) ? mobj : null;
    }
    else {
        let newpaths = [];

        let tokpath = okpath || mobj.src.file.startsWith(usercodeDir);
        mobj.callPaths.forEach(function (cmobj) {
            let scc = stdFilterMemoryObject(cmobj, usercodeDir, tokpath);
            if(scc) {
                newpaths.push(scc);
            }
        });

        if(newpaths.length === 0) {
            return null;
        }
        else {
            mobj.callPaths = newpaths;
            return mobj;
        }
    }
}

exports.computeTotalMemoryUse = computeTotalMemoryUse;
exports.stdFilterMemoryObject = stdFilterMemoryObject;
