const { cargoQuery, initWikiClient, initDatabaseClient } = require("../src/common");
const { updateTokenWithParams } = require("../src/wikiapi-utils");
const logger = require("../src/logger");

// Constants
const CARGO_TABLE_NAME = "supports";
const TEMPLATE_NAME = "Support";

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
  params.title_jp             = fetchTextData(76).replace("[","").replace("]","");
  params.rarity               = ["", "R", "SR", "SSR"][data.rarity] || params.rarity || "";
  params.type                 = data.command_id;
  params.series               = noop(params.series);
  params.obtain               = noop(params.obtain);
  params.release_date         = noop(params.release_date);
  params.limited              = noop(params.limited);
  params.link_gamewith        = noop(params.link_gamewith);
  params.link_kamigame        = noop(params.link_kamigame);
  params.unique_bonus         = noop(params.unique_bonus);
  params.effects              = noop(params.effects);
  params.skills               = noop(params.skills);
  params.events               = noop(params.events);
  params.episode              = noop(params.episode);
  params.episode_jp           = fetchTextData(88);

  return params;
}

// update pulls wiki page data and updates it
const update = async (data) => {
  const pageName = determinePageName(data.id);
  const page = await wiki.page(pageName);
  const parsed = page.parse();
  const original = parsed.toString();

  // Look for Support template and edit
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

// updateOne pulls data of a support card from db and runs update with it
const updateOne = async (id) => {
  logger.info(`==> Synchronizing support card id ${id}…`);
  const statement = db.prepare(`SELECT * FROM support_card_data WHERE support_card_data.id=${id} LIMIT 1`);
  const result = statement.get();
  update(result);
}

// updateAll pulls all id from support_card_data and runs update with each of them
const updateAll = async () => {
  logger.info(`==> Synchronizing all support cards…`);
  const statement = db.prepare("SELECT * FROM support_card_data");
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
  command: "supportcard <id|all>",
  aliases: "sc",
  builder: {
    id: {
      describe: "Specific support card id to update",
      type: "string",
    },
  },
  desc: "",
};
