// Requires
var fs = require('fs');
var Discord = require('discord.js');
var osu = require('node-osu'); //https://www.npmjs.com/package/node-osu
var cleverbot = require("cleverbot.io");
var settings = require('./settings.json');

// Vars
// keys
var osuKey = settings.osuKey;
var discordKey = settings.discordKey;

// others
var bot = new Discord.Client();
var cbot = new cleverbot(settings.cleverbotUser, settings.cleverbotKey);
global.osuApi = new osu.Api(osuKey);  
var data = [], channel = settings.channel;
var modes = ['Standard','Taiko', 'Ctb', 'Mania'];
var userScores = {}; // key array (object) storing user scores, key is user id + "_" _ modes
var beatmaps = {}; // beatmaps[beatmapid] = []; // beatmaps[beatmapid][mode];
// userScores['id_mode'].scores
// userScores['id_mode'].ranks.global
// userScores['id_mode'].ranks.country
// userScores['id_mode'].acc
// consts
const prefix = '-';
const VERBOSE = settings.VERBOSE;
global.VERBOSE = VERBOSE;

// Functions
cbot.setNick("osuBot"); 
bot.on('ready', () => {
  console.log(`Logged in as ${bot.user.tag}!`);
  bot.user.setStatus("online");
  bot.user.setActivity("Loading...");
  
  // load new ava if file exists
  if (fs.existsSync("./avatar.png")) {
    bot.user.setAvatar("./avatar.png").then(()=>fs.unlink("./avatar.png"));
  }

  // change the channel id to an actual channel object
  channel = bot.guilds.array()[0].channels.get(channel);
  var ready = true;

  // load beatmap database
  beatmaps = data.beatmaps || {};

  // check for data, and load
  if (fs.existsSync('./data.json')) {
    // load file and set
    var newData = require('./data.json');
    ready = false;
    if (newData.data.length == 0) {
      ready = true;
    }
    let timer = 0;
    let counter = 0;
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
              obj.acc = user_.accuracy;
              userScores[user_.id+"_"+d.mode] = obj;
              counter++;
              if (counter == newData.data.length) {
                ready = true;
              }
            }).catch((e) => {
              ignore(e);
              counter++;
              if (counter == newData.data.length) {
                ready = true;
              }
            });
          }, 40);
        }).catch((e) => {
          ignore(e);
          counter++;
          if (counter == newData.data.length) {
            ready = true;
          }
        });
      }, timer);
      timer+=500;
    }
  }

  // loop until all the users are loaded in
  var startupTimer = setInterval(() => {
    if (ready) {
      console.log('ready');
      setGame();
      clearInterval(startupTimer);
      // start checking users
      var CHECKcount = 0;
      setInterval(() => {
        if (CHECKcount > data.length) CHECKcount = 0;
        if (data[CHECKcount]) check(data[CHECKcount]);
        CHECKcount++;
      }, 500);
    }
  }, 50);
});

bot.on('message', onMessage);
bot.login(discordKey);

// functions
function ignore(e) {
  if (VERBOSE) console.log(e);
}
function sortScore(a, b) {
  // trim score data
  delete a.user;
  // finally the calculation
  return parseFloat(b.pp) - parseFloat(a.pp);
}

// bot functions
function addUser(chan, user, mode) {
  for (let i in data) {
    if (data[i].username == user && data[i].mode == mode) {
      chan.send("I am already tracking "+ user +" for that mode!");
      return;
    }
  }
  // get the user from osu
  osuApi.getUser({u: user, type: 'string'}).then(user_ => {
    data.push(new Data(user_.username||user, mode, user_.id));
    chan.send('Now tracking ' + (user_.username||user) +"'s " + modes[mode].toLowerCase() + " scores.");
    save();
    setTimeout(() => {
      osuApi.getUserBest({u:user_.id, m:mode, type:'id', limit:100, a:1}).then(scores => {
        let obj = {};
        obj.scores = scores.sort(sortScore);
        obj.ranks = {g:user_.pp.rank, c:user_.pp.countryRank};
        obj.acc = user_.accuracy;
        userScores[user_.id+"_"+mode] = obj;
        setGame();
      }).catch(ignore);
    }, 4000);
  }).catch(e => {
    if (e.message.includes("not found")) chan.send("That user was not found :c");
    else ignore(e);
  });
  save();
}
function remUser(chan, user, mode) {
  for (let i in data) {
    if (data[i].username == user && data[i].mode == mode) {
      delete (data[i]);
      chan.send("I am no longer following " + user + " for mode " + modes[mode]);
      save();
      setGame();
      return;
    }
  }
  chan.send("I am not tracking " + user + " for that mode!");
}
function updateUser(chan, user) {
  user = user.toLowerCase();
  for (let i in data) {
    if (data[i].username.toLowerCase() == user) {
      osuApi.getUser(data[i].getOptions()).then((u) => {
        chan.send("Updated " + data[i].username + " -> " + u.name + " for mode " + modes[data[i].mode]);
        data[i].username = u.name;
        save();
      }).catch(ignore);
    }
  }
}

// function to set the "now playing" to how many users we are tracking
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
    bot.user.setActivity('Checking ' + count + ' users!');
  }, 50);
}

//TODO
function onMessage(msg) {
  // stuff to do if there is no prefix
  if (!msg.content.startsWith(prefix)) {
    // check for mentions
    // if the bot was mentioned, reply with a cleverbot reply
    if (msg.mentions.users.has(bot.user.id)) {
      // initialize cleverbot
      cbot.create(function (err, session) {
        // Woo, you initialized cleverbot.io.  Insert further code here
        msg.channel.startTyping();
        cbot.ask(msg.content.replace(bot.user.toString(),""), (err1, response) => {
          msg.channel.stopTyping();
          msg.channel.send(response + " nyaa~");
        });
      });
      return;
    }

    // osu links (needs to be updated for new site links)
    if (msg.content.includes('osu.ppy.sh/b/')) {
      try {
        let regex = /osu.ppy.sh\/b\/\d{1,8}(\?m=\d)*/;
        let id = regex.exec(msg.content)[0].replace('osu.ppy.sh/b/','');
        let mode = id.split('?m=');
        id = mode[0];
        mode = mode[1];
        beatmapInfo(id, mode||0, msg.channel);
      } catch(e) {
        console.log(e);
      }
    } else if (msg.content.includes('osu.ppy.sh/beatmapsets')) {
      // https://osu.ppy.sh/beatmapsets/801506#osu/1682424
      let split = msg.content.split('/');
      let id = split[split.length-1];
      let mode = undefined;
      for (let i in modes) if (msg.content.includes(modes[i])) mode = i;
      beatmapInfo(id, mode, msg.channel);
    }
    // return so we dont continue into commands
    return;
  }

  // _ing _ong stuff
  msg.content = msg.content.substring(prefix.length);
  if (msg.content.endsWith("ing")) {
    let str = msg.content.split("ing").join("ong");
    msg.channel.send(str);
    return;
  }

  // bot commands 
  var s = msg.content.split(' ');
  let user = s[1], mode = s[2];
  switch (s[0]) {
    case "track":
      if (!mode) addUser(msg.channel, user, 0); else {
        let q = mode.split(',');
        for (let i in q) {
          i=q[i].trim();
          switch(i.charAt(0)) {
            case't':mode=1;break;
            case'c':mode=2;break;
            case'm':mode=3;break;
            default:mode=0;break;
          }
          addUser(msg.channel, user, mode)
        }
      }
      break;
    case "untrack":
      if (!mode) remUser(msg.channel, user, 0); else {
        let q = mode.split(',');
        for (let i in q) {
          i=q[i].trim();
          switch(i.charAt(0)) {
            case't':mode=1;break;
            case'c':mode=2;break;
            case'm':mode=3;break;
            default:mode=0;break;
          }
          remUser(msg.channel, user, mode)
        }
      }
      break;
    case 'update': updateUser(msg.channel, user); break
    case 'help': help(msg.channel); break;
    case 'info': info(s[1]); break;
  }
}
// maybe remake this so it uses embeds?
function help(c) {
  let help_ = "do `-track [username] [mode,[mode]]` to track\n";
  help_ += "ex, `-track remii standard, taiko` or if you're lazy `-track remii s,t`\n";
  help_ += "to stop tracking, do `-untrack [username] [mode,[mode]]`\n";
  help_ += "ex `-untrack remii standard, taiko` or if you're lazy `-untrack remii s,t`\n";
  help_ += "if you have changed your username in osu, the bot will not recognise this.\n"
  help_ += "to fix this, please run `-update [old username]`"
  c.send(help_);
}

// send user data to `channel`
function sendData(data, score, number, newScores) {
  let userThings = userScores[data.user+"_"+data.mode];
  let oldScores = userThings.scores;
  getBeatmap({b:score.beatmapId}).then(beatmap => {
    osuApi.getUser(data.getOptions()).then(user_ => {
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
            return sendData(channel,  data, score, number, newScores);
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
            acc=(0.5*counts['100']+counts['300']+counts['geki']+0.5*counts['katu'])/(counts['miss']+counts['100']+counts['300']+counts['geki']+counts['katu']);
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
        channel.send(e);
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

      // mods
      if (score.mods.length > 0) {
        for (let i in score.mods) {
          i = score.mods[i];
          if (i.includes('FreeModAllowed')) continue;
          if (score.mods.includes('Nightcore') && i.includes('DoubleTime')) continue;
          fieldText += i + ' ';
        }
      } else fieldText += "No mods";
      fieldText += '\n';

      //user acc
      let userAcc = "";
      if (user_.accuracy != userThings.acc && (user_.accuracy - userThings.acc).toFixed(2)!=0) {
        userAcc += " " + (user_.accuracy < userThings.acc?"" : "+");
        userAcc += (user_.accuracy - userThings.acc).toFixed(2) + "%";
      }

      // pp, acc and add field
      embed.addField("**" + score.pp + "pp** (+" + (ppOld-ppNew).toFixed(2) + 'pp)' + userAcc, fieldText);
      // ==================================================
      embed.setAuthor(data.username, 'https://a.ppy.sh/' + data.user, 'https://osu.ppy.sh/u/'+data.user);
      embed.setImage('https://b.ppy.sh/thumb/'+beatmap.beatmapSetId+'l.jpg');
      channel.send(embed);
      //userScores[user_.id+"_"+data.mode].ranks = {g:user_.pp.rank, c:user_.pp.countryRank};
      userScores[user_.id+"_"+data.mode].acc = user_.accuracy;
    }).catch(ignore);
  }).catch(ignore);
}

// beatmap info function
function beatmapInfo(id, mode, chan) {
  getBeatmap({b:id, m:mode, a:1}).then(beatmap => {
    let embed = new Discord.RichEmbed();
    embed.setTitle(beatmap.title+' ['+beatmap.version+']');
    let fieldText = 'Mapper: ' + beatmap.creator + '\n';
    fieldText += 'Bpm: ' + beatmap.bpm + '\n';
    // time
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
    chan.send(embed);
  });
}


class Data {
  constructor(user, mode, userId){
    this.mode = mode;
    this.username = user;
    this.user = userId;
  }
  getOptions() {
    return {u:this.user, m:this.mode, type:'id', limit:100, a:1};
  }
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

// unintelligable save function
function save() {
  let nd = [];
  for (let i in data) {
    if (!data[i] || !data[i].user) continue;
    nd.push({username:data[i].username, mode:data[i].mode, user:data[i].user});
  }
  let s = JSON.stringify({'data':nd, "beatmaps":beatmaps});
  fs.writeFile('./data.json', s);
}




// beatmap database get function
function getBeatmap(options) {
  console.log(">>>>>getting beatmap " + options.b + " with mode " + (options.m || "default"));
  let p = new Promise((resolve, reject) => {
    // options is the object passed to osuApi.getBeatmap;
    if (!beatmaps[options.b] || !beatmaps[options.b][options.m||0]) {
      // i dont think this is needed anymore
      if (!options.mode) delete options.mode;
      // this is needed for converts, otherwise all hell will break lose
      options.a=1;
      // get the beatmap
      console.log("looking up beatmap on osu db");
      osuApi.getBeatmaps(options).then(beatmap => {
        console.log("found beatmap on osu db");
        // fix beatmap (delete unused tags)
        beatmap = beatmap[0];
        delete beatmap.tags; 
        delete beatmap.counts; 
        delete beatmap.hash; 
        delete beatmap.approvedDate; 
        delete beatmap.lastUpdate;
        // make sure the beatmap can be added
        if (!beatmaps[options.b]) beatmaps[options.b] = [];
        // and add it
        beatmaps[options.b][options.m||0] = beatmap;
        // save changes
        save();
        // return the beatmap
        resolve(beatmap);
      })
      // on error
      .catch((e) => {
        console.log("not found, trying again with no mode");
        delete options.m;
        // need to check local db first
        if (!beatmaps[options.b] || !beatmaps[options.b][0]) {
          console.log("looking up beatmap on osu db (no mode)");
          osuApi.getBeatmaps(options).then(beatmap => {
            console.log("found beatmap on osu db");
            // fix beatmap (delete unused tags)
            beatmap = beatmap[0];
            delete beatmap.tags; 
            delete beatmap.counts; 
            delete beatmap.hash; 
            delete beatmap.approvedDate; 
            delete beatmap.lastUpdate;
            
            // make sure the beatmap can be added
            if (!beatmaps[options.b]) beatmaps[options.b] = [];
            // and add it
            beatmaps[options.b][0] = beatmap;
            // save changes
            save();
            // return the beatmap
            resolve(beatmap);
          })
          // on error
          .catch((e) => {
            console.log("not found, giving up");
          });
        } 
        else { // found in local db
          console.log('found beatmap in local db');
          resolve(beatmaps[options.b][options.m||0]); 
        }
      });
    }
    else { // found in local db
      console.log('found beatmap in local db')
      resolve(beatmaps[options.b][options.m||0]);
    }
  });
  return p;
}