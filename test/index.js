import fs from "fs";
import {
  SC_URL,
  check_url,
  download,
  get_playlist,
  search_movie,
  update_url,
} from "../dist/index.mjs";

if (!(await check_url())) {
  console.log(`${SC_URL} is not valid anymore.`);
  const new_url = "https://streamingcommunity.at";
  console.log(`Updating url to ${new_url}`);
  update_url(new_url);
}

const query1 = await search_movie("enola holmes", {
  match_estimate: true,
  match_exact: true,
});

const query2 = await search_movie("enola holmes", {
  match_exact: true,
});

const query3 = await search_movie("rick and morty", {
  match_exact: true,
});

console.log("(Should match more than one film)");
console.log(query1);
console.assert(query1.length > 1);
console.log("(Should possibly match only one film)");
console.log("--------------------");
console.log(query2);
console.assert(query2.length == 1);
console.log("(Should possibly match more than one film)");
console.log(query3);
console.assert(query3.length >= 1);

const playlist1 = await get_playlist(query1[0].id, query1[0].scws_id);
const playlist2 = await get_playlist(query1[1].id, query1[1].scws_id);
const playlist3 = await get_playlist(query3[0].id, query3[0].seasons[2].episodes[3].scws_id, query3[0].seasons[2].episodes[3].id);

console.log("(Should be a working playlist)");
console.log(playlist1);
console.log("(Should be a working playlist)");
console.log(playlist2);
console.log("(Should be a Rick and Morty S3 E4 playlist)");
console.log(playlist3);
console.log(query3[0].seasons[2].episodes[3].name);
console.log(query3[0].seasons[2].episodes[3].plot);

console.log("downloading Rick and Morty S3 E4 as url");
console.log(await download(playlist3, "url"));
console.log(
  "downloading Rick and Morty S3 E4 as buffer and then saving to local file /test/movie.mp4"
);
fs.writeFileSync("test/movie.mp4", await download(playlist3, "buffer"));
