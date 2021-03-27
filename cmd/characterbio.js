const { cargoQuery, initWikiClient, initDatabaseClient } = require("../src/common");
const { updateTokenWithParams } = require("../src/wikiapi-utils");
const logger = require("../src/logger");

// Constants
const CARGO_TABLE_NAME = "character_biographies";
const TEMPLATE_NAME = "CharacterBiography";

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
  params.icon                 = noop(params.icon);
  params.art                  = noop(params.art);
  params.name                 = noop(params.name);
  params.name_jp              = fetchTextData(6);
  params.va                   = noop(params.va);
  params.va_jp                = fetchTextData(7);
  params.birth_year           = data.birth_year;
  params.birth_month          = data.birth_month;
  params.birth_day            = data.birth_day;
  params.birth_place          = noop(params.birth_place);
  params.height               = data.scale;
  params.bust                 = noop(params.bust);
  params.waist                = noop(params.waist);
  params.hip                  = noop(params.hip);
  params.weight               = noop(params.weight);
  params.weight_jp            = fetchTextData(9);
  params.talent               = noop(params.talent);
  params.talent_jp            = fetchTextData(164);
  params.weakpoint            = noop(params.weakpoint);
  params.weakpoint_jp         = fetchTextData(165);
  params.ear_detail           = noop(params.ear_detail);
  params.ear_detail_jp        = fetchTextData(166);
  params.tail_detail          = noop(params.tail_detail);
  params.tail_detail_jp       = fetchTextData(167);
  params.shoe_size            = noop(params.shoe_size);
  params.shoe_size_jp         = fetchTextData(168);
  params.family_detail        = noop(params.family_detail);
  params.family_detail_jp     = fetchTextData(169);
  params.skin                 = data.skin;
  params.socks                = data.socks;
  params.team                 = noop(params.team);
  params.image_color_main     = data.image_color_main;
  params.image_color_sub      = data.image_color_sub;
  params.ui_color_main        = data.ui_color_main;
  params.ui_color_sub         = data.ui_color_sub;
  params.ui_training_color_1  = data.ui_training_color_1;
  params.ui_training_color_2  = data.ui_training_color_2;
  params.ui_border_color      = data.ui_border_color;
  params.ui_num_color_1       = data.ui_num_color_1;
  params.ui_num_color_2       = data.ui_num_color_2;
  params.ui_turn_color        = data.ui_turn_color;
  params.ui_wipe_color_1      = data.ui_wipe_color_1;
  params.ui_wipe_color_2      = data.ui_wipe_color_2;
  params.ui_wipe_color_3      = data.ui_wipe_color_3;
  params.ui_speech_color_1    = data.ui_speech_color_1;
  params.ui_speech_color_2    = data.ui_speech_color_2;
  params.ui_nameplate_color_1 = data.ui_nameplate_color_1;
  params.ui_nameplate_color_2 = data.ui_nameplate_color_2;

  return params;
}

// update pulls wiki page data and updates it
const update = async (data) => {
  const pageName = determinePageName(data.id);
  const page = await wiki.page(pageName);
  const parsed = page.parse();
  const original = parsed.toString();

  // Look for CharacterBiography template and edit
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
  const statement = db.prepare(`SELECT * FROM chara_data WHERE chara_data.id=${id} LIMIT 1`);
  const result = statement.get();
  update(result);
}

// updateAll pulls all id from card_data and runs update with each of them
const updateAll = async () => {
  logger.info(`==> Synchronizing all characters…`);
  const statement = db.prepare("SELECT * FROM chara_data");
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
  command: "characterbio <id|all>",
  aliases: "cb",
  builder: {
    id: {
      describe: "Specific character id to update",
      type: "string",
    },
  },
  desc: "",
};
