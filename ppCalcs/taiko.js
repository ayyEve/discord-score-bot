const ACCS_TO_TEST = [100, 99, 98, 97, 96];
const Discord = require('discord.js');
module.exports = function(options) {
  let embed = new Discord.RichEmbed();
  let body = '';
  let ez = options.mods.includes('ez');
  let hr = options.mods.includes('hr');
  let ht = options.mods.includes('ht');
  let dt = options.mods.includes('dt');
  let hd = options.mods.includes('hd');
  let fl = options.mods.includes('fl');
  let nf = options.mods.includes('nf');
  if (ht || dt) {
    body += "**PP calculations with DT/HT __will__ be wrong, do not expect an accurate answer!**\n";
  }
  function scaleOd(od) {
    if (ez) od /= 2;
    if (hr) od *= 1.4;
    od = Math.max(Math.min(od, 10), 0);
    return od;
  };
  function hitWindow(od){
    od = scaleOd(od);
    let max = 20;
    let min = 50;
    let result = min + (max - min) * od / 10;
    result = Math.floor(result) - 0.5;
    if (ht) result /= 0.75;
    if (dt) result /= 1.5;
    // 2 decimals
    return Math.round(result * 100) / 100;
  };
  function displayOD() {
    let od = options.beatmap.difficulty.overall;
    let scaled = scaleOd(od);
    scaled = Math.round(scaled * 100) / 100;
    let hitWin = hitWindow(od);
    return "OD w/mods: " + scaled + '(hitwindow: ' + hitWin + "ms)\n";
  };
  function calcPP(acc) {
    let strain = options.beatmap.difficulty.rating;
    let hitcount = options.beatmap.maxCombo;
    let misses = options.misses||0;
    let usercombo = hitcount - misses;
    let OD300 = hitWindow(options.beatmap.difficulty.overall);
    if (strain < 0 || hitcount < 0 || misses < 0 || usercombo < 0 || acc < 0 || acc > 100 || OD300 < 0 || misses > hitcount) {
      //TODO maybe make this more user friendly
      return "Check your values and try again";
    }
    let StrainValue = Math.pow(Math.max(1,strain/0.0075) * 5 - 4,2)/100000;
    let LengthBonus = Math.min(1, hitcount/1500) * 0.1 + 1;
    StrainValue *= LengthBonus;
    StrainValue *= Math.pow(0.985, misses);
    StrainValue *= Math.min(Math.pow(usercombo, 0.5) / Math.pow(hitcount, 0.5),1);
    StrainValue *= acc/100;
    let AccValue = Math.pow(150/OD300, 1.1) * Math.pow(acc/100, 15) * 22;
    AccValue *= Math.min(Math.pow(hitcount/1500, 0.3), 1.15);
    let ModMultiplier = 1.10;
    if (hd) {
        ModMultiplier *= 1.10;
        StrainValue *= 1.025;
    }
    if (nf) ModMultiplier *= 0.90;
    if (fl) StrainValue *= 1.05 * LengthBonus;
    let TotalValue = Math.pow(Math.pow(StrainValue, 1.1) + Math.pow(AccValue, 1.1), 1.0/1.1) * ModMultiplier;
    return Math.round(TotalValue * 100) / 100 + " pp"
  };

  body += displayOD();
  body += 'with ' + (options.misses||0) + ' misses:\n';
  if (options.acc === -1) {
    for (let i in ACCS_TO_TEST) {
      body += '> ' + ACCS_TO_TEST[i] + "%: " + calcPP(ACCS_TO_TEST[i]) + '\n';
    }
  } else {
    body += '=> ' + options.acc + "%: " + calcPP(options.acc) + '\n';
  }
  console.log(body);

  embed.addField('Results for ' + options.beatmap.title + '[' + options.beatmap.version +']', body);
  embed.setTitle('Taiko PP Calculation');
  embed.setURL('http://osu.ppy.sh/b/' + options.beatmapID);
  embed.setFooter('code from https://pp.mon.im/');
  return embed;
}
