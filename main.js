// Requires
var fs = require('fs');
var readline = require('readline');
var Discord = require('discord.js');
var osu = require('node-osu'); //https://www.npmjs.com/package/node-osu
var request = require('request');
var ppCalc = require('./ppCalc.js');
var settings = require('./settings.json');
var BeatmapDatabase = require('./dataCache.js');

// Vars
// keys
var osuKey = settings.osuKey;
var discordKey = settings.discordKey;

// others
var bot = new Discord.Client();
global.osuApi = new osu.Api(osuKey);
var data = [], channel = settings.channel;
var modes = ['Standard','Taiko', 'Ctb', 'Mania'];
var userScores = {}; // key array (object) storing user scores, key is user id + "_" _ modes
// userScores['id'].scores
// userScores['id'].ranks.global
// userScores['id'].ranks.country
// consts
const prefix = '-';
const updateTime = 20000; // every 20 seconds
const VERBOSE = settings.VERBOSE;
global.VERBOSE = VERBOSE;

// Functions
BeatmapDatabase.init(osuApi)
bot.on('ready', () => {
  console.log(`Logged in as ${bot.user.tag}!`);
  bot.user.setStatus("online");

  // check for data, and load
  if (fs.existsSync('./data.json')) {
    // load file and set
    var newData = require('./data.json');
    let timer = 0;
    for (let i in newData.data) {
      let d = new Data(newData.data[i].username, newData.data[i].mode, newData.data[i].user);
      data.push(d);

      setTimeout(() => {
        // load user bests
        osuApi.getUserBest({u:d.user, m:d.mode, type:'id', limit:100, a:1}).then(scores => {
          setTimeout(() => {
            osuApi.getUser(d.getOptions()).then(user_ => {
              console.log("loading user " + d.username + " with mode " + modes[d.mode]);
              let obj = {};
              obj.scores = scores.sort(sortScore);
              obj.ranks = {g:user_.pp.rank, c:user_.pp.countryRank};
              userScores[user_.id+"_"+d.mode] = obj;
            }).catch(ignore);
          }, 40);
        }).catch(ignore);
      }, timer);
      timer+=500;
    }
  }
  setGame();
  checkAll();
});
bot.on('message', onMessage);
bot.login(discordKey);

// helpers
function ignore(e) {
  if (VERBOSE) console.log(e);
}
function sortScore(a, b) {
  // trim score data
  delete a.user;
  // finally the calculation
  return parseFloat(b.pp) - parseFloat(a.pp);
}
function addUser(user, mode) {
  for (let i in data) {
    if (data[i].username == user && data[i].mode == mode) {
      sendMessage("I am already tracking "+ user +" for that mode!");
      return;
    }
  }
  osuApi.getUser({u: user, type: 'string'}).then(user_ => {
    data.push(new Data(user_.username||user, mode, user_.id));
    sendMessage('Now tracking ' + (user_.username||user) +"'s " + modes[mode].toLowerCase() + " scores.");
    save();
    setTimeout(() => {
      osuApi.getUserBest({u:user_.id, m:mode, type:'id', limit:100, a:1}).then(scores => {
        let obj = {};
        obj.scores = scores.sort(sortScore);
        obj.ranks = {g:user_.pp.rank, c:user_.pp.countryRank};
        userScores[user_.id+"_"+mode] = obj;
        setGame();
      }).catch(ignore);
    }, 4000);
  }).catch(e => {
    if (e.message.includes("not found")) sendMessage("That user was not found :c");
    else ignore(e);
  });
  save();
}
function remUser(user, mode) {
  for (let i in data) {
    if (data[i].username == user && data[i].mode == mode) {
      delete (data[i]);
      sendMessage("I am no longer following " + user + " for mode " + modes[mode]);
      save();
      setGame();
      return;
    }
  }

  sendMessage("I am not tracking " + user + " for that mode!");
}
function updateUser(user) {
  user = user.toLowerCase();
  for (let i in data) {
    if (data[i].username.toLowerCase() == user) {
      osuApi.getUser(data[i].getOptions()).then((u) => {
        sendMessage("Updated " + data[i].username + " -> " + u.name + " for mode " + modes[data[i].mode]);
        data[i].username = u.name;
        save();
      });
    }
  }
}
function setGame() {
  setTimeout(()=>{
    let count = 0;
    let users = {};
    for (let i in data) {
      if (!users[data[i].user+""]) {
        users[data[i].user+""] = 1;
        count++;
      }
    }
    bot.user.setGame('Checking ' + count + ' users!');
  }, 50);
}

//TODO
function onMessage(msg) {
  if (!msg.content.startsWith(prefix)) {
    if (msg.mentions.users.has(bot.user.id)) {
      if (msg.content.toLowerCase().includes('cookie')) {
        if (!msg.content.toLowerCase().includes("t!cookie")) msg.channel.sendMessage("i need moar");
      }
      else msg.channel.sendMessage("im hungry\ngimme cookies");
    }
    if (msg.content.includes('osu.ppy.sh/b/')) {
      try {
        let regex = /osu.ppy.sh\/b\/\d{1,8}(\?m=\d)*/;
        let id = regex.exec(msg.content)[0].replace('osu.ppy.sh/b/','');
        let mode = id.split('?m=');
        id = mode[0];
        mode = mode[1];
        beatmapInfo(id, mode||0, msg.channel.id);
      } catch(e) {
        console.log(e);
      }
    }
    return;
  }

  msg.content = msg.content.substring(prefix.length);
  var s = msg.content.split(' ');
  let user = s[1], mode = s[2];
  switch (s[0]) {
    case "ping":
      msg.channel.send("pong!");
      break;
    case "track":
      if (!mode) addUser(user, 0); else {
        let q = mode.split(',');
        for (let i in q) {
          i=q[i].trim();
          switch(i.charAt(0)) {
            case't':mode=1;break;
            case'c':mode=2;break;
            case'm':mode=3;break;
            default:mode=0;break;
          }
          addUser(user, mode)
        }
      }
      break;
    case "untrack":
      if (!mode) remUser(user, 0); else {
        let q = mode.split(',');
        for (let i in q) {
          i=q[i].trim();
          switch(i.charAt(0)) {
            case't':mode=1;break;
            case'c':mode=2;break;
            case'm':mode=3;break;
            default:mode=0;break;
          }
          remUser(user, mode)
        }
      }
      break;
    case "pp":
      let x = msg.content.split(' ');
      x.shift();
      msg.content = x.join(' ');
      ppCalc(msg.content, sendMessage, msg.channel.id);
      break;
    case 'update':
      updateUser(user);
      break
    case 'help': help(msg.channel.id); break;
    case 'info': info(s[1]); break;
  }
}
function help(channel_) {
  let help_ = "do `-track [username] [mode,[mode]]` to track\n";
  help_ += "ex, `-track remii standard, taiko` or if you're lazy `-track remii s,t`";
  sendMessage(help_, undefined, channel_);
}
function sendMessage(txt, options, channelOverride, then) {
  let c = channelOverride;
  if (!c) c = channel;
  if (!c) return;
  try {
    bot.guilds.array()[0].channels.get(c).send(txt, options).then(then).catch(ignore);
  } catch (e) {
    console.log(e);
  }
}
function sendData(data, score, number, newScores) {
  let userThings = userScores[data.user+"_"+data.mode];
  let oldScores = userThings.scores;
  BeatmapDatabase.getBeatmaps({b:score.beatmapId}).then(beatmap => {
    beatmap = beatmap[0];
    // update the user ranks
    //calc diff in pp
    let ppOld = 0, ppNew = 0;
    for (let n in newScores) {
      ppOld += parseFloat(newScores[n].pp * Math.pow(0.95, n));
      if (oldScores[n])
        ppNew += parseFloat(oldScores[n].pp * Math.pow(0.95, n));
    }
    if (ppOld-ppNew == 0) return; // fixes weird bug
    if (ppOld-ppNew<0) {
      score = oldScores[number-1];
      //look for the beatmap
      for (let n = number-5; n < oldScores.length; n++) {
        let newScore = newScores[n];
        if (newScore.beatmapId == score.beatmapId) {
          score = newScore;
          number = n+1;
          console.log("pp lost");
          return sendData(data, score, number, newScores);
        }
      }
      console.log("pp lost");
      return;
    }

    // calc acc and max combo
    let acc = 0, counts = score.counts, maxCombo=0;
    for (let i in counts) counts[i] = parseInt(counts[i]);
    try {
      switch (data.mode) {
        case 0: // standard
          acc=(50*counts['50']+100*counts['100']+300*counts['300'])/(300*(counts['miss']+counts['50']+counts['100']+counts['300']));
          //acc=(50*counts['50']+100*(counts['100']+counts['katu'])+300*(counts['300']+counts['geki']))/(300*(counts['miss']+counts['50']+counts['100']+counts['katu']+counts['300']+counts['geki']));
          break;
        case 1: // taiko
          acc=(0.5*counts['100']+counts['300']+counts['geki'])/(counts['miss']+counts['100']+counts['300']+counts['geki']+counts['katu']);
          break;
        case 2:// ctb
          acc=(counts['50']+counts['100']+counts['300'])/(counts['katu']+counts['miss']+counts['50']+counts['100']+counts['300']);
          break;
        case 3: // mania
          acc=(50*counts['50']+100*counts['100']+200*counts['katu']+300*(counts['300']+counts["geki"]))/(300*(counts['miss']+counts['50']+counts['100']+counts['katu']+counts['300']+counts['geki']));
          break;
      }
      acc *= 100;
    } catch (e) {
      sendMessage(e);
      console.log(e);
      acc = "err";
      maxCombo = "err";
    }
    if (beatmap.maxCombo) maxCombo = beatmap.maxCombo;

    // do the rest of the things
    let embed = new Discord.RichEmbed();
    embed.setTitle('New ' + modes[data.mode] + ' Score! (#'+number+" user best)");
    let fieldText = "";

    // beatmap link
    fieldText += '['+beatmap.title +'['+beatmap.version+']](https://osu.ppy.sh/b/'+beatmap.id+')';
    fieldText += '\n';

    // beatmap info
    fieldText += beatmap.bpm + 'bpm, ' + parseFloat(beatmap.difficulty.rating).toFixed(2) + ' stars';
    fieldText += '\n';

    //rank
    fieldText += 'Rank: ' + score.rank + ` (${acc.toFixed(2)}%)`;
    fieldText += '\n';

    // mods TODO: var mods = ""; later: if mods=="" mods = "No mods\n"
    if (score.mods.length > 0) {
      for (let i in score.mods) {
        i = score.mods[i];
        if (i.includes('FreeModAllowed')) continue;
        if (score.mods.includes('Nightcore') && i.includes('DoubleTime')) continue;
        fieldText += i + ' ';
      }
    } else fieldText += "No mods";
    fieldText += '\n';

    // pp and add field
    embed.addField("**" + score.pp + "pp** (+" + (ppOld-ppNew).toFixed(2) + 'pp)', fieldText);
    // ==================================================
    embed.setAuthor(data.username, 'https://a.ppy.sh/' + data.user, 'https://osu.ppy.sh/u/'+data.user);
    embed.setImage('https://b.ppy.sh/thumb/'+beatmap.beatmapSetId+'l.jpg');
    sendMessage(embed);
    //userScores[user_.id+"_"+data.mode].ranks = {g:user_.pp.rank, c:user_.pp.countryRank};
  }).catch(ignore);
}

function beatmapInfo(id, mode, channel_) {
  BeatmapDatabase.getBeatmaps({b:id, m:mode, a:1}).then(beatmap => {
    beatmap = beatmap[0];
    let embed = new Discord.RichEmbed();
    embed.setTitle(beatmap.title+' ['+beatmap.version+']');
    let fieldText = 'Mapper: ' + beatmap.creator + '\n';
    fieldText += 'Bpm: ' + beatmap.bpm + '\n';
    let time = parseInt(beatmap.time.total)
    let seconds = time%60;
    let mins = (time-seconds)/60;
    // drain
    let time_ = parseInt(beatmap.time.drain);
    let seconds_ = time_%60;
    let mins_ = (time_-seconds_)/60;
    fieldText += "Time/Drain: "+ mins+":"+seconds +"/"+ mins_+":"+seconds_ +"\n";
    // add it
    embed.addField('General', fieldText);

    let diff = 'Rating: '+ parseInt(beatmap.difficulty.rating).toFixed(2) + '*\n';
    diff += 'OD: ' + beatmap.difficulty.overall +'\n';
    diff += 'HP: ' + beatmap.difficulty.drain + '\n';

    embed.addField('Difficulty', diff);
    // ==================================================
    //embed.setAuthor(data.username, 'https://a.ppy.sh/' + data.user, 'https://osu.ppy.sh/u/'+data.user);
    embed.setImage('https://b.ppy.sh/thumb/'+beatmap.beatmapSetId+'l.jpg');
    sendMessage(embed, undefined, channel_);
  });
}

var Data = function(user, mode, userId) {
  this.mode = mode;
  this.username = user;
  this.user = userId;
}
Data.prototype.getOptions = function() {
  return {u:this.user, m:this.mode, type:'id', limit:100, a:1};
}

function checkAll() {
  var CHECKcount = 0;
  setInterval(() => {
    if (CHECKcount > data.length) CHECKcount = 0;
    if (data[CHECKcount]) check(data[CHECKcount]);
    CHECKcount++;
  }, 500);
}
function check(data) {
  // get user best
  if (!userScores[data.user+"_"+data.mode]) return console.log('error with ' + data.username+"."+modes[data.mode]);
  osuApi.getUserBest(data.getOptions()).then(bScores => {
    // check for changes in the user's best
    let newScores = bScores.sort(sortScore);
    let checkScores = userScores[data.user+"_"+data.mode].scores.sort(sortScore);

    let x = 0;
    for (let i in newScores) {
      x++;
      let newScore = newScores[i];
      let checkScore = checkScores[i];
      //=====================================================
      if ((newScore.beatmapId != checkScore.beatmapId) ||
          (newScore.beatmapId == checkScore.beatmapId &&
           newScore.pp != checkScore.pp)) {
        sendData(data, newScore, x, newScores);
        userScores[data.user+"_"+data.mode].scores = newScores;
        return;
      }
    }

    // if the user is new and doesnt have 100 scores, it wont find a match
    if (newScores.length > checkScores.length) {
      // reset counter
      x = 0;
      console.log("new > check");

      // loop through new Scores
      for (let i in newScores) {
        // increment counter
        x++;
        // vars
        let newScore = newScores[i];
        let found = 0;
        // loop over old scores, make sure the newScore exists
        for (let n in checkScores) {
          let checkScore = checkScores[n];
          if (newScore.beatmapId == checkScore.beatmapId) {
            found = 1;
            break;
          }
        }

        // didnt find a match, must be the new score
        if (!found) {
          sendData(data, newScore, x, newScores);
          userScores[data.user+"_"+data.mode].scores = newScores;
          return;
        }
      }
    }


    // update the user ranks
    osuApi.getUser(data.getOptions()).then(user_ => {
      userScores[user_.id+"_"+data.mode].rank = {g:user_.pp.rank, c:user_.pp.countryRank};
    }).catch(ignore);
  }).catch(ignore);
}
function save() {
  let nd = [];
  for (let i in data) {
    if (!data[i] || !data[i].user) continue;
    nd.push({username:data[i].username, mode:data[i].mode, user:data[i].user});
  }
  let s = JSON.stringify({'data':nd});
  fs.writeFile('./data.json', s);
}

/// Readline shit
readline.createInterface({input:process.stdin, output:process.stdout}).on('line', (line)=> {
  try {
    console.log(eval(line));
  } catch(e) {
    console.log(e);
  }
});

/*
function sendData_FIXGLOBALCOUNTRYRANKINGANDCOMBO(data, score, number, newScores) {
  let oldScores = userScores[data.user+"_"+data.mode].scores;
  osuApi.getBeatmaps({b:score.beatmapId}).then(beatmap => {
    beatmap = beatmap[0];
    // update the user ranks
    osuApi.getUser(data.getOptions()).then(user_ => {
      //calc diff in pp
      let ppOld = 0, ppNew = 0;
      for (let n in newScores) {
        ppOld += parseFloat(newScores[n].pp * Math.pow(0.95, n));
        ppNew += parseFloat(oldScores[n].pp * Math.pow(0.95, n));
      }
      if (ppOld-ppNew == 0) return;
      if (ppOld-ppNew<0) {
        score = oldScores[number-1];
        //look for the beatmap
        for (let n = number-5; n < oldScores.length; n++) {
          let newScore = newScores[n];
          if (newScore.beatmapId == score.beatmapId) {
            score = newScore;
            number = n+1;
            console.log("pp lost");
            return sendData(data, score, number, newScores);
          }
        }
      }

      // calc acc and max combo
      let acc = 0, counts = score.counts, maxCombo=0;
      for (let i in counts) counts[i] = parseInt(counts[i]);
      try {
        switch (data.mode) {
          case 0: // standard
            acc=(50*counts['50']+100*(counts['100']+counts[katu])+300*(counts['300']+counts['geki']))/(300*(counts['50']+counts['100']+counts['300']));
            //maxCombo = counts['50'] + counts['100'] + counts['katu'] + counts['300'] + counts['geki'] + counts['miss'];
            break;
          case 1: // taiko
            acc=(0.5*counts['100']+counts['300']+counts['geki'])/(counts['miss']+counts['100']+counts['300']+counts['geki']+counts['katu']);
            //maxCombo = counts['100'] + counts['300'] + counts['miss'];
            break;
          case 2:// ctb
            acc=(counts['50']+counts['100']+counts['300'])/(counts['katu']+counts['miss']+counts['50']+counts['100']+counts['300']);
            //maxCombo = counts['50']+counts['100']+counts['300'] + counts[miss];
            break;
          case 3: // mania
            acc=(50*counts['50']+100*counts['100']+200*counts['katu']+300*(counts['300']+counts["geki"])/(300*(counts['50']+counts['100']+counts['300']+counts['geki']));
            //maxCombo = counts['50'] + counts['100'] + counts['katu'] + counts['300'] + counts['geki'] + counts['miss'];
            break;
        }
        acc *= 100;
      } catch (e) {
        sendMessage(e);
        console.log(e);
        acc = "err";
        maxCombo = "err";
      }
      if (beatmap.maxCombo) maxCombo = beatmap.maxCombo;

      // do the rest of the things
      let embed = new Discord.RichEmbed();
      embed.setTitle('New ' + modes[data.mode] + ' Score! (#'+number+" user best)");
      let fieldText = "";

      // beatmap link
      fieldText += '['+beatmap.title +'['+beatmap.version+']](https://osu.ppy.sh/b/'+beatmap.id+')';
      fieldText += '\n';

      // beatmap info
      fieldText += beatmap.bpm + 'bpm, ' + parseFloat(beatmap.difficulty.rating).toFixed(2) + ' stars';
      fieldText += '\n';

      // combo etc
      //fieldText += "Max Combo: " + score.maxCombo + '/'+ maxCombo + ', Rank: ' + score.rank + `(${acc.toFixed(2)}%)`;
      fieldText += 'Rank: ' + score.rank + ` (${acc.toFixed(2)}%)`;
      fieldText += '\n';

      // mods TODO: var mods = ""; later: if mods=="" mods = "No mods\n"
      if (score.mods.length > 0) {
        for (let i in score.mods) {
          i = score.mods[i];
          if (i.includes('FreeModAllowed')) continue;
          if (score.mods.includes('Nightcore') && i.includes('DoubleTime')) continue;
          fieldText += i + ' ';
        }
      } else fieldText += "No mods";
      fieldText += '\n';

      // pp and add field
      embed.addField("**" + score.pp + "pp** (+" + (ppOld-ppNew).toFixed(2) + 'pp)', fieldText);
      // ==================================================
      let userThings = userScores[user_.id+"_"+data.mode];
      let rankStr = "";
      console.log("global", user_.pp.rank, ":", userThings.ranks.g);
      console.log("country", user_.pp.countryRank, ":", userThings.ranks.c)

      if (user_.pp.rank < userThings.ranks.g) {
        rankStr += " #" + user_.pp.rank + " +" + (userThings.ranks.g-user_.pp.rank);
        if (user_.pp.countryRank < userThings.ranks.c) {
          rankStr += " ("+user_.country + user_.pp.countryRank + " +" + (userThings.ranks.c - user_.pp.countryRank) + ")";
        }
      }
      embed.setAuthor(data.username + rankStr, 'https://a.ppy.sh/' + data.user, 'https://osu.ppy.sh/u/'+data.user);
      embed.setImage('https://b.ppy.sh/thumb/'+beatmap.beatmapSetId+'l.jpg');
      sendMessage(embed);
      userScores[user_.id+"_"+data.mode].ranks = {g:user_.pp.rank, c:user_.pp.countryRank};
    }).catch(ignore);
  }).catch(ignore);
}
*/
