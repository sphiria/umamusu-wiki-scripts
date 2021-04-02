const { cargoQuery, initWikiClient, initDatabaseClient } = require("../src/common");
const { updateTokenWithParams } = require("../src/wikiapi-utils");
const logger = require("../src/logger");

// Constants
const CARGO_TABLE_NAME = "characters";
const TEMPLATE_NAME = "Character";
const CHARACTER_QUERY = `
SELECT card_data."id" AS id, card_data."chara_id" AS chara_id, default_rarity,
talent_speed, talent_stamina, talent_pow, talent_guts, talent_wiz, limited_chara,
r1.speed AS speed1, r1.stamina AS stamina1, r1.pow AS power1, r1.guts AS guts1, r1.wiz AS wisdom1,
r2.speed AS speed2, r2.stamina AS stamina2, r2.pow AS power2, r2.guts AS guts2, r2.wiz AS wisdom2,
r3.speed AS speed3, r3.stamina AS stamina3, r3.pow AS power3, r3.guts AS guts3, r3.wiz AS wisdom3,
r4.speed AS speed4, r4.stamina AS stamina4, r4.pow AS power4, r4.guts AS guts4, r4.wiz AS wisdom4,
r5.speed AS speed5, r5.stamina AS stamina5, r5.pow AS power5, r5.guts AS guts5, r5.wiz AS wisdom5,
r5.proper_ground_turf AS aptitude_turf, r5.proper_ground_dirt AS aptitude_dirt,
r5.proper_distance_short AS aptitude_short, r5.proper_distance_mile AS aptitude_mile,
r5.proper_distance_middle AS aptitude_middle, r5.proper_distance_long AS aptitude_long,
r5.proper_running_style_nige AS aptitude_runner, r5.proper_running_style_senko AS aptitude_leader,
r5.proper_running_style_sashi AS aptitude_betweener, r5.proper_running_style_oikomi AS aptitude_chaser
FROM card_data
LEFT OUTER JOIN card_rarity_data AS r1 ON r1.card_id = card_data.id AND r1.rarity = 1
LEFT OUTER JOIN card_rarity_data AS r2 ON r2.card_id = card_data.id AND r2.rarity = 2
LEFT OUTER JOIN card_rarity_data AS r3 ON r3.card_id = card_data.id AND r3.rarity = 3
LEFT OUTER JOIN card_rarity_data AS r4 ON r4.card_id = card_data.id AND r4.rarity = 4
LEFT OUTER JOIN card_rarity_data AS r5 ON r5.card_id = card_data.id AND r5.rarity = 5`;

// Globals
let wiki, db;
let idPageMap = new Map();
let dryRun = false;

// fetchIdPageMap returns simplified id:page map from cargo
const fetchIdPageMap = async () => {
  logger.verbose("=> Fetching id:page map from cargotable…");
  const data = await cargoQuery(CARGO_TABLE_NAME, "_pageName=name,id");

  // build a map out of it for easier use
  const map = new Map();
  data.cargoquery.forEach(d => map.set(parseInt(d.title.id, 10), d.title.name));
  return map;
}

// determinePageName checks id:page map for page name
const determinePageName = id => {
  const page = idPageMap.get(id);
  if (page) {
    logger.info(`===> Found page "${page}" for id "${id}"`);
    return page;
  }

  logger.warn(`Failed to find page for id ${id}`);
  logger.warn(`Using id ${id} as page name`);
  return id;
}

// updateParameters is the actual function that
// determines and updates the template parameters with data from master.mdb
const updateParameters = (data, originalParams) => {
  const statement = db.prepare(`SELECT text FROM text_data WHERE category = ? AND \`index\` = ${data.id}`);
  const fetchTextData = categoryid => statement.get(parseInt(categoryid, 10))?.text || "";
  const noop = text => (text) ? text : "";
  const params = {...originalParams};

  params.id                   = data.id;
  params.chara_id             = data.chara_id;
  params.icon                 = noop(params.icon);
  params.art                  = noop(params.art);
  params.title                = noop(params.title);
  params.title_jp             = fetchTextData(5).replace("[","").replace("]","");
  params.base_star            = data.default_rarity;
  params.series               = noop(params.series);
  params.obtain               = noop(params.obtain);
  params.release_date         = noop(params.release_date);
  params.limited              = data.limited_chara;
  params.link_gamewith        = noop(params.link_gamewith);
  params.link_kamigame        = noop(params.link_kamigame);
  params.speed1               = noop(data.speed1); // May not exist
  params.speed2               = noop(data.speed2); // May not exist
  params.speed3               = data.speed3;
  params.speed4               = data.speed4;
  params.speed5               = data.speed5;
  params.stamina1             = noop(data.stamina1); // May not exist
  params.stamina2             = noop(data.stamina2); // May not exist
  params.stamina3             = data.stamina3;
  params.stamina4             = data.stamina4;
  params.stamina5             = data.stamina5;
  params.power1               = noop(data.power1); // May not exist
  params.power2               = noop(data.power2); // May not exist
  params.power3               = data.power3;
  params.power4               = data.power4;
  params.power5               = data.power5;
  params.guts1                = noop(data.guts1); // May not exist
  params.guts2                = noop(data.guts2); // May not exist
  params.guts3                = data.guts3;
  params.guts4                = data.guts4;
  params.guts5                = data.guts5;
  params.wisdom1              = noop(data.wisdom1); // May not exist
  params.wisdom2              = noop(data.wisdom2); // May not exist
  params.wisdom3              = data.wisdom3;
  params.wisdom4              = data.wisdom4;
  params.wisdom5              = data.wisdom5;
  params.speed_growth_bonus   = data.talent_speed;
  params.stamina_growth_bonus = data.talent_stamina;
  params.power_growth_bonus   = data.talent_pow;
  params.guts_growth_bonus    = data.talent_guts;
  params.wisdom_growth_bonus  = data.talent_wiz;
  params.unique_skill         = noop(params.unique_skill);
  params.unique_skill_evolved = noop(params.unique_skill_evolved);
  params.aptitude_turf        = data.aptitude_turf;
  params.aptitude_dirt        = data.aptitude_dirt;
  params.aptitude_short       = data.aptitude_short;
  params.aptitude_mile        = data.aptitude_mile;
  params.aptitude_medium      = data.aptitude_middle;
  params.aptitude_long        = data.aptitude_long;
  params.aptitude_runner      = data.aptitude_runner;
  params.aptitude_leader      = data.aptitude_leader;
  params.aptitude_betweener   = data.aptitude_betweener;
  params.aptitude_chaser      = data.aptitude_chaser;
  params.skills               = noop(params.skills);
  params.awakening_materials  = noop(params.awakening_materials);
  params.awakening1           = noop(params.awakening1);
  params.awakening2           = noop(params.awakening2);
  params.awakening3           = noop(params.awakening3);
  params.awakening4           = noop(params.awakening4);
  params.events               = noop(params.events);
  params.ura_objectives       = noop(params.ura_objectives);
  params.model_file           = noop(params.model_file);
  params.model_texture        = noop(params.model_texture);

  return params;
}

// update pulls wiki page data and updates it
const update = async (data) => {
  const pageName = determinePageName(data.id);
  const page = await wiki.page(pageName);
  const parsed = page.parse();
  const original = parsed.toString();

  // Look for Character template and edit
  parsed.each("template", token => {
    if (token.name != TEMPLATE_NAME) return;
    const newParams = updateParameters(data, token.parameters);
    updateTokenWithParams(token, newParams);
  });
  const result = parsed.toString();

  // Just print result if dry-run
  if (dryRun) {
    logger.diff(original, result);
    logger.info("===> Dry-run mode; skipping edit!");
    return;
  }

  // Submit edit
  logger.info("===> Submitting changes…")
  wiki.edit(result, { bot: 1 });
  logger.info("===> … Done!")
}

// updateOne pulls data of a character from db and runs update with it
const updateOne = async (id) => {
  logger.info(`==> Synchronizing character id ${id}…`);
  const statement = db.prepare(`${CHARACTER_QUERY} WHERE "card_data"."id" = "${id}" LIMIT 1`);
  const result = statement.get();
  update(result);
}

// updateAll pulls all id from card_data and runs update with each of them
const updateAll = async () => {
  logger.info(`==> Synchronizing all characters…`);
  const statement = db.prepare(CHARACTER_QUERY);
  const results = statement.all();

  // Loop through each results
  for(let i=0; i<results.length; i++) {
    logger.info(`===> Synchronizing ${i+1}/${results.length}…`)
    await update(results[i]);
  }
}

// handler processes the command parameters/flags and starts the update process
const handler = async (argv) => {
  db = await initDatabaseClient(argv.file);
  wiki = await initWikiClient();
  idPageMap = await fetchIdPageMap();
  dryRun = argv.dryRun;

  if (argv.id === "all") { await updateAll(); return; }
  updateOne(argv.id);
}

// yargs command definition
module.exports = {
  handler,
  command: "character <id|all>",
  aliases: "c",
  builder: {
    id: {
      describe: "Specific character id to update",
      type: "string",
    },
  },
  desc: "",
};
