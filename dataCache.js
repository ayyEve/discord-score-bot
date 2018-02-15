// Vars
var osuApi = global.osuApi;
var beatmaps = {}; // beatmaps[beatmapid] = []; // beatmaps[beatmapid][mode];
var database = require('./database.json');
var fs = require('fs');
function getBeatmaps(options) {
  console.log(">>>>>getting beatmap " + options.b);
  try {
    let p = new Promise((resolve, reject) => {
      // options is the object passed to osuApi.getBeatmap;
      if (!beatmaps[options.b] || !beatmaps[options.b][options.m||0]) {
        if (!options.mode) delete options.mode;
        osuApi.getBeatmaps(options).then(beatmap => {
          beatmap=beatmap[0];
          // delete unused things
          delete beatmap.tags;
          delete beatmap.counts;
          delete beatmap.hash;
          delete beatmap.approvedDate;
          delete beatmap.lastUpdate;
          beatmaps[options.b] = [];
          beatmaps[options.b][options.m||0] = beatmap;
          save();
          resolve([beatmap]);
        }).catch(err => {
          if (err.toString().includes('not found')) {
            console.log('beatmap ' + options.b +' not found with mode ' + beatmap.m);
            delete options.m;
            osuApi.getBeatmaps(options).then(beatmap => {
              beatmap=beatmap[0];
              delete beatmap.tags
              delete beatmap.counts;
              delete beatmap.hash;
              delete beatmap.approvedDate;
              delete beatmap.lastUpdate;
              if (!beatmaps[options.b]) beatmaps[options.b] = [];
              beatmaps[options.b][0] = beatmap;
              save();
              resolve([beatmap]);
            }).catch(e=>{
              console.log('beatmap '+ options.b + ' not found');
              reject(e);
            });
          }
          else {
            console.log(err);
            reject(err);
          };
        });
      }
      else {
        resolve(beatmaps[options.b][options.m||0]);
      }
    });
    //return p;
    p.then(console.log).catch(console.log);
  } catch (e) {
    console.log(e);
  }
  return osuApi.getBeatmaps(options);
}
// save
function save() {
  let v = JSON.stringify({'beatmaps':beatmaps});
  console.log(v);
  fs.writeFile('database.json', v);
}
module.exports = {
  'getBeatmaps':getBeatmaps,
  'init': function(api) {
    osuApi = api;
  }
};
