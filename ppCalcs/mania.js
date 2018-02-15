ACCS_TO_TEST = [100, 98, 96, 95, 93, 90];
SCORES_TO_TEST = [1000000, 900000, 850000, 800000, 750000, 700000];
const Discord = require('discord.js');
const parser = require('osu-parser');

module.exports = function(options) {
  //return "Not implemented yet, sorry";
  let embed = new Discord.RichEmbed();
  let body = '';
	function pp(acc, score, hitObjects) {
		let rating = options.beatmap.difficulty.rating; //SR
		let OD = options.beatmap.difficulty.overall; //OD
		let objects = options.dbeatmap.hitObjects.length; //Objects
		let f = 64 - 3*OD;
		let k = Math.pow((150/f)*Math.pow(acc/100,16),1.8)*2.5*Math.min(1.15,Math.pow(objects/1500,0.3));
		let l = (Math.pow(5*Math.max(1,rating/0.0825)-4,3)/110000)*(1+0.1*Math.min(1,objects/1500));
		let m = (score<500000) ? score/500000*0.1 : ((score<600000) ? (score-500000)/100000*0.2+0.1 : ((score<700000) ? (score-600000)/100000*0.35+0.3 : ((score<800000) ? (score-700000)/100000*0.2+0.65 : ((score<900000) ? (score-800000)/100000*0.1+0.85 : (score-900000)/100000*0.05+0.95))));
		return Math.round(Math.pow(Math.pow(k,1.1)+Math.pow(l*m,1.1),1/1.1)*1.1) + "PP\n";
	}

  if (options.acc === -1) {
    for (let i in ACCS_TO_TEST) {
      let acc = ACCS_TO_TEST[i];
      let score = SCORES_TO_TEST[i];
      body += "> " + acc + "% with " + score + " : " + pp(acc, score);
    }
  } else {
    let acc = options.acc;
    body += "> " + acc + "% with " + 1000000 + "score: " + pp(acc, 1000000);
  }

  embed.setTitle('Mania PP Calculation');
  embed.addField('Results for ' + options.beatmap.title + '[' + options.beatmap.version +']', body);
  embed.setURL('http://osu.ppy.sh/b/' + options.beatmapID);
  embed.setFooter('code from http://maniapp.uy.to/, a big thank you to PotassiumF!');
  console.log(body);
  console.log(embed);
  return embed;
}
