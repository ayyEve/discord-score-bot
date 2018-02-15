const request = require('request');
const parser = require('osu-parser');
const standard = require('./ppCalcs/standard');
const taiko = require('./ppCalcs/taiko');
const mania = require('./ppCalcs/mania');
const ctb = require('./ppCalcs/ctb');
const MODS = ['hd', 'hr', 'dt', 'ez', 'fl', 'ht', 'nf'];
const PP_CALCS = [standard, taiko, ctb, mania];

//TODO: check if beatmap is compatable with current mode (ie taiko cannot be played on a mania map)
// you can do this in the pp calculators

var calc = function(options, msg) {
  let regex = /\d+/;
  let o = options.split(' ');
  let beatmapID = regex.exec(o[0])[0];
  let mods = [];
  let mode = -1, modeSet = 0;
  let misses = 0;
  let acc = -1;

  // parse options
  console.log('options');
  if (o.length === 0) console.log(' => no options');
  for (let i = 1; i < o.length; i++) {
    let option = o[i];
    console.log("\noption: " + option);
    // if option is empty, just move onto the next one
    if (!option) {continue;}

    // check for misses
    console.log(' => checking for misses');
    if (option.includes('miss')) {
      console.log(' ==> found');
      try {
        misses = parseInt(regex.exec(option));
      } catch (e) {
        // no number found
      }
      continue;
    }

    // check for accuracy
    console.log(' => checking for accuracy');
    if (option.includes('%')) {
      console.log(' ==> found');
      try {
        acc = parseInt(regex.exec(option));
      } catch (e) {
        // no number found
      }
    }

    console.log(' => checking for mode');
    // check for mode TODO: check for uppercase too
    if (option.toLowerCase().startsWith('s')) {mode=0; modeSet = 1; continue;} // mode is std
    if (option.toLowerCase().startsWith('t')) {mode=1; modeSet = 1; continue;} // mode is taiko
    if (option.toLowerCase().startsWith('c')) {mode=2; modeSet = 1; continue;} // mode is ctb
    if (option.toLowerCase().startsWith('m')) {mode=3; modeSet = 1; continue;} // mode is mania
    // not a mode seletion, check for mods

    console.log(' => checking for mods');
    for (let i in MODS) {
      let mod = MODS[i];
      if (option.toLowerCase().includes(mod)) {
        console.log(' ==> found mod: ' + mod);
        mods.push(mod);
      }
    }
  }
  console.log('\nget beatmap');
  let beatmapOptions = {b:beatmapID};
  if (mode!==-1) beatmapOptions = {b: beatmapID, m:mode, a:1};
  global.osuApi.getBeatmaps(beatmapOptions).then(beatmap => {
    beatmap=beatmap[0];
    console.log(' => got beatmap');
    let options2 = {};
    options2.beatmapID = beatmapID;
    options2.mods = mods;
    options2.id = beatmapID;
    options2.beatmap = beatmap;
    options2.misses = misses;
    options2.acc = acc;

    // if mode was not set
    if (mode == -1) {
      console.log(' => mode not set, checking for beatmap mode');
      // check for mode
      let m = beatmap.mode.toLowerCase();
      if (m.startsWith('s')) {mode=0;} // mode is std
      if (m.startsWith('t')) {mode=1;} // mode is taiko
      if (m.startsWith('c')) {mode=2;} // mode is ctb
      if (m.startsWith('m')) {mode=3;} // mode is mania
      console.log(' ==> mode is now set to ' + mode);
    }
    osuApi.getScores({b: beatmapID, m:mode, a:1}).then((scores, beatmap2) => {
      //if (!modeSet) {
      //}
      if (!options2.beatmap.maxCombo) {
        console.log(' => beatmap has no maxCombo, attempting to find one in the scores');
        for (let i in scores) {
          let score = scores[i];
          if (score.perfect || score.counts.miss == 0) {
            options2.beatmap.maxCombo = score.maxCombo;
            console.log(' ==> new max combo is now ' + score.maxCombo);
            break;
          }
        }
      }

      //obtaining beatmap
      request('https://osu.ppy.sh/osu/' + beatmapID, (a, b, c) => {
        let downloadedBeatmap = parser.parseContent(c);
        options2.dbeatmap = downloadedBeatmap;

        console.log('now running pp calculations');
        let run = PP_CALCS[mode];
        let out = run(options2);
        msg.edit(out);
      });
    });
  });
}

var calc_ = function(options, sendMessage) {
  sendMessage('Calculating, please wait.',0, options.channel, (msg)=>{
    calc(options, msg)
  });
}
module.exports = calc_;
