const { cargoQuery, initWikiClient, initDatabaseClient } = require("../src/common");
const { updateTokenWithParams } = require("../src/wikiapi-utils");
const logger = require("../src/logger");

// Constants
const CARGO_TABLE_NAME = "races";
const TEMPLATE_NAME = "Race";
const RACE_TRACKS = {
  10001: "Sapporo", // 札幌
  10002: "Hakodate", // 函館
  10003: "Niigata", // 新潟
  10004: "Fukushima", // 福島
  10005: "Nakayama", // 中山
  10006: "Tokyo", // 東京
  10007: "Chukyo", // 中京
  10008: "Kyoto", // 京都
  10009: "Hanshin", // 阪神
  10010: "Kokura", // 小倉
  10101: "Ooi", // 大井
};
const RACE_CATEGORIES = {
  1: { // Common(?) races
    100: "G1",
    200: "G2",
    300: "G3",
    400: "OP",
    700: "Pre-OP"
  },
  2: { // Daily races
    999: "EX" // Classified as "Daily" by RaceDefine, but EX ingame
  },
  7: { // Training mode specific races
    100: "EX", // Classified as G1 by RaceDefine, seem to represent URA Finals (EX)?
    800: "Maiden", // 未勝利 races
    900: "Debut"
  },
  8: { // Legend races
    100: "EX" // Classified as Legend by RaceDefine, but EX ingame
  },
  9: { // Team Stadium
    100: "G1" // Races just display the Class ingame
  },
  61: { // "Custom G1 races"
    100: "G1"
  },
};
const RACE_TERRAIN = {
  1: "Turf",
  2: "Dirt",
};
const RACE_DIRECTION = {
  1: "Right",
  2: "Left",
  3: "Straight Right",
  4: "Straight Left",
};
const RACE_COURSE = {
  1: "", // None
  2: "Inner",
  3: "Outer",
  4: "Outer to Inner",
};
const RACE_QUERY = `
SELECT race_instance.id AS id, race_instance.race_id AS race_id,
race."group" AS "group", race.grade AS grade, race.course_set AS course_set, race.entry_num,
course.race_track_id AS race_track_id, course.distance AS distance,
course.ground AS terrain, course.inout AS course, course.turn AS direction,
program.month AS month, program.half AS half, program.need_fan_count AS required_fans,
program.race_permission AS class, fan_sets.fan_count AS fan_count
FROM race_instance
LEFT OUTER JOIN race ON race.id = race_instance.race_id
LEFT OUTER JOIN race_course_set AS course ON course.id = course_set
LEFT OUTER JOIN single_mode_program AS program ON program.race_instance_id = race_instance."id" AND program.base_program_id = 0
LEFT OUTER JOIN single_mode_fan_count AS fan_sets ON program.fan_set_id = fan_sets.fan_set_id AND fan_sets."order" = 1`;

// In text_data category 28, all races with instance ID >= 580001 have a ton of name duplicates and represent
// URA Finals, Maiden Races, Team Stadium Races, Main Story Races, and similar. These will be manually extracted.
// ID 102501 is a 宝塚記念 (101201) Dupe, ID 102601 is a 菊花賞 (101501) Dupe,
// ID 102701 is a 天皇賞（春）(100601) Dupe and ID 203501 is a スプリングステークス (201001) Dupe
const RACE_BLACKLIST = `
WHERE race_instance.id < 580001 AND (
race_instance.id IS NOT 102501 AND
race_instance.id IS NOT 102601 AND
race_instance.id IS NOT 102701 AND
race_instance.id IS NOT 203501
);`;

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
  const statement = db.prepare(`SELECT text FROM text_data WHERE category = ? AND \`index\` = ?`);
  const fetchTextData = (categoryid, index) => statement.get(parseInt(categoryid, 10), index ? parseInt(index, 10) : data.id)?.text || "";
  const noop = text => (text) ? text : "";
  const params = {...originalParams};

  params.id            = data.id;
  params.race_id       = data.race_id;
  params.banner        = noop(params.banner);
  params.name          = noop(params.name);
  params.name_jp       = fetchTextData(28);
  params.track         = RACE_TRACKS[data.race_track_id] || ""; // Fetches EN name from ID or empty if EN name is not set
  params.track_jp      = fetchTextData(35, data.race_track_id); // From race
  params.grade         = RACE_CATEGORIES[data.group][data.grade]; // From race
  params.trophy        = noop(params.trophy); // Only exists for G3, G2, G1, EX grade
  params.terrain       = RACE_TERRAIN[data.terrain]; // From race_course_set
  params.length        = data.distance; // From race_course_set
  params.direction     = RACE_DIRECTION[data.direction]; // From race_course_set
  params.track_course  = RACE_COURSE[data.course]; // From race_course_set: inout
  params.class         = data.class || ""; // From: single_mode_program: race_permission, may be empty if race is unused
  params.month         = data.month || ""; // From single_mode_program, may be empty if race is unused
  params.month_half    = data.half || ""; // From single_mode_program, may be empty if race is unused
  params.fans          = data.fan_count || ""; // From single_mode_fan_count: fan_set_id (single_mode_program) with order == 1 (order => place), may be empty if race is unused
  params.required_fans = data.required_fans || ""; // From single_mode_program: need_fan_count, may be empty if race is unused
  params.participants  = data.entry_num;

  return params;
}

// update pulls wiki page data and updates it
const update = async (data) => {
  const pageName = determinePageName(data.id);
  const page = await wiki.page(pageName);
  const parsed = page.parse();
  const original = parsed.toString();

  // Look for Race template and edit
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

// updateOne pulls data of a race from db and runs update with it
const updateOne = async (id) => {
  logger.info(`==> Synchronizing race ${id}…`);
  const statement = db.prepare(`${RACE_QUERY} WHERE race_instance.id=${id} LIMIT 1`);

  const result = statement.get();
  update(result);
}

// updateAll pulls all id from race and runs update with each of them
const updateAll = async () => {
  logger.info(`==> Synchronizing all races…`);
  const statement = db.prepare(`${RACE_QUERY} ${RACE_BLACKLIST}`);

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
  command: "race <id|all>",
  aliases: "r",
  builder: {
    id: {
      describe: "Specific race id to update",
      type: "string",
    },
  },
  desc: "",
};
