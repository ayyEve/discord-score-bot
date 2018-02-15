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
    body += "**PP calculations with any mods __will__ be innacurate due to changes in sr**\n";
  }

	function pp(acc) {
    let mcombo = options.dbeatmap.hitObjects.length;
    let stars = options.beatmap.difficulty.rating;
    let ar = options.beatmap.difficulty.approach;
		let combo = options.combo || mcombo;
		let miss=options.miss||0;
		if (combo>mcombo) combo=mcombo;
		if (ar>11) ar=11;
    if (dt) ar = dtFix(ar);

		// Conversion from Star rating to pp
		final = Math.pow(((5*(stars)/ 0.0049)-4),2)/100000;
		// Length Bonus
		lengthbonus = (0.95 + 0.4 * Math.min(1.0, mcombo / 3000.0) + (mcombo > 3000 ? Math.log10(mcombo / 3000.0) * 0.5 : 0.0));
		final *= lengthbonus;
		// Miss Penalty
		final *= Math.pow(0.97, miss);
		// Not FC combo penalty
		final *= Math.pow(combo/mcombo,0.8);
		// AR Bonus
		if (ar>9) final*= 1+  0.1 * (ar - 9.0);
		if (ar<8) final*= 1+  0.025 * (8.0 - ar);
		// Acc Penalty
		final *=  Math.pow(acc/100, 5.5);
		return Math.round(100*final)/100 + "pp\n";
	}
	function dtFix(ar) {
		if (ar>5)	ms = 200+(11-ar)*100;
		else ms = 800+(5-ar)*80;
		if (ms<300) ar = 11;
		else if (ms<1200) ar = Math.round((11-(ms-300)/150)*100)/100;
		else ar = Math.round((5-(ms-1200)/120)*100)/100;
    return ar;
	}

  body += 'with ' + (options.misses||0) + ' misses:\n';
  if (options.acc === -1) {
    for (let i in ACCS_TO_TEST) {
      body += '> ' + ACCS_TO_TEST[i] + "%: " + pp(ACCS_TO_TEST[i]) + '\n';
    }
  } else {
    body += '=> ' + options.acc + "%: " + pp(options.acc) + '\n';
  }
  console.log(body);
  embed.addField('Results for ' + options.beatmap.title + '[' + options.beatmap.version +']', body);
  embed.setTitle('Ctb PP Calculation');
  embed.setURL('http://osu.ppy.sh/b/' + options.beatmapID);
  embed.setFooter('code from https://pakachan.github.io/osustuff/ppcalculator.html');
  return embed;
}
