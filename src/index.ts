import * as crypto from "crypto";
import { Episode, Image, Movie, Season } from "./types";
import { array_insert, compare_strings, decode_html, get, get_of_page } from "./utils";

export let SC_URL = "https://streamingcommunity.boston";
const DEC_KEY_URL = "https://scws.work/storage/enc.key";

export async function check_url() {
  const res = await fetch(SC_URL).catch(() => ({ status: 404 }));
  return res.status == 200;
}

export function update_url(url: string) {
  SC_URL = url;
}

/**
 * @description It can match the exact name or, if exact and estimate are true, can estimate the match of the movie title relative to the name we're searching for
 */
export async function search_movie(
  name: string,
  {
    max_results = 3,
    match_estimate,
    match_exact,
  }: {
    max_results?: number;
    match_exact?: boolean;
    match_estimate?: boolean;
  }
): Promise<Movie[]> {
  const data = JSON.parse(
    (
      await get_of_page(
        `${SC_URL}/search?q=${name}`,
        new RegExp('<div id="app".+data-page="(.+)"><!--', "s"),
        [1]
      )
    )[0]
  );

  const records = data.props.titles;

  const movies_found: Movie[] = [];
  let count = 0;
  for (const record of records) {
    if (count++ >= max_results) {
      break;
    }
    const movie = await retrieve_movie_info(record, {
      match_exact: match_exact ? name : undefined,
      match_estimate: match_estimate,
    });
    if (!movie) {
      continue;
    }
    movies_found.push(movie);
  }

  return movies_found;
}

async function retrieve_movie_info(
  record: Record<string, any>,
  {
    match_exact,
    match_estimate,
  }: {
    match_exact?: string;
    match_estimate?: boolean;
  }
): Promise<Movie | null> {
  const slug = record.slug;
  const id = record.id;
  const images: Image[] = record.images.map((image_info: any) => {
    return {
      type: image_info.type,
      url: `${SC_URL.replace("https://", "https://cdn.")}/images/${
        image_info.filename
      }`,
    };
  });

  const data_page = JSON.parse(
    (
      await get_of_page(
        `${SC_URL}/titles/${id}-${slug}`,
        new RegExp('<div id="app" data-page="(.+)"><!--', "s"),
        [1]
      )
    )[0]
  );

  const movie_info = data_page.props.title;
  const score = movie_info.score;
  const release_date = movie_info.release_date;

  const friendly_name = movie_info.name;
  if (match_exact) {
    if (match_estimate) {
      const { equal, matches, maxMatches } = compare_strings(
        match_exact,
        friendly_name
      );
      if (!equal && matches < maxMatches / 2) {
        return null;
      }
    } else if (friendly_name.toLowerCase() !== match_exact.toLowerCase()) {
      return null;
    }
  }

  const plot = movie_info.plot;
  const scws_id = movie_info.scws_id;
  const trailers = movie_info.trailers;

  let trailer_url = null;
  let embed_trailer_url = null;
  if (trailers.length > 0) {
    trailer_url = `https://youtube.com/watch?v=${trailers[0].youtube_id}`;
    embed_trailer_url = `https://youtube.com/embed/${trailers[0].youtube_id}`;
  }

  const seasons: Season[] = [];
  const seasons_info = movie_info.seasons;

  for (const season of seasons_info) {
    const season_info = JSON.parse(
      (
        await get_of_page(
          `${SC_URL}/titles/${id}-${slug}/stagione-${season.number}`,
          new RegExp('<div id="app" data-page="(.+)"><!--', "s"),
          [1]
        )
      )[0]
    ).props.loadedSeason;

    const episodes: Episode[] = [];
    for (const episode of season_info.episodes) {
      episodes.push({
        id: episode.id,
        name: episode.name,
        number: episode.number,
        plot: episode.plot,
        scws_id: episode.scws_id,
      });
    }

    seasons.push({
      number: season.number,
      episodes,
    });
  }

  return {
    embed_trailer_url,
    friendly_name,
    id,
    images,
    is_series: seasons.length > 0,
    plot,
    release_date,
    score,
    scws_id,
    seasons,
    slug,
    trailer_url,
  };
}

export async function get_playlist(id: number, scwsId: number, episodeId: number = 0): Promise<string> {
  return fetch(`${SC_URL}/iframe/${id}?episode_id=${episodeId}`, {cache: "no-cache"}).then(res => res.text()).then(sciframe => {
    const srcIndex = sciframe.indexOf("src")
    const endIndex = sciframe.indexOf('"', srcIndex + 77)
    const embedUrl = new URL(decode_html(sciframe.slice(srcIndex + 5, endIndex)))
    return fetch(embedUrl).then(res => res.text()).then(scembed => {
      const tokenIndex = scembed.indexOf("token") + 1
      const tokenEndIndex = scembed.indexOf("'", tokenIndex + 28)
      const expiresIndex = scembed.indexOf("e", tokenEndIndex) + 1
      const token = scembed.slice(tokenIndex + 8, tokenEndIndex)
      const expires = scembed.slice(expiresIndex + 10, scembed.indexOf("'", expiresIndex + 14))
      const playlistUrl = new URL(`https://vixcloud.co/playlist/${scwsId}`)
      playlistUrl.searchParams.append("token", token)
      playlistUrl.searchParams.append("expires", expires)
      if (embedUrl.searchParams.get("b")) playlistUrl.searchParams.append("b", "1");
      if (embedUrl.searchParams.get("canPlayFHD")) playlistUrl.searchParams.append("h", "1");
      return playlistUrl.toString()
    })
  })
}

async function retrieve_video_playlist(
  master_playlist: string
): Promise<string> {
  let master_playlist_lines = master_playlist.split("\n");
  const match_valid_playlist_url = new RegExp(
    "^https:.+rendition=.+token=.+&expires.+"
  );

  let playlist_url = "";
  for (let i = 0; i < master_playlist_lines.length; i++) {
    const line = master_playlist_lines[i];
    if (match_valid_playlist_url.test(line)) {
      playlist_url = line;
      break;
    }
  }

  const playlist = await get(playlist_url);
  let playlist_lines = playlist.split("\n");

  array_insert(playlist_lines, 2, "#EXT-X-ALLOW-CACHE:YES");

  const match_credentials_line = new RegExp('#EXT-X-KEY.+URI="(.+)",IV.+');

  for (let i = 0; i < playlist_lines.length; i++) {
    if (match_credentials_line.test(playlist_lines[i])) {
      const match_key_uri = new RegExp('URI=".+"');

      playlist_lines[i] = playlist_lines[i].replace(
        match_key_uri,
        `URI="${DEC_KEY_URL}"`
      );
      break;
    }
  }

  return playlist_lines.join("\n");
}

async function get_buffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url).catch((err) => {
    throw new Error(`While trying to get ${url}: ${err}`);
  });
  const buffer = await response.arrayBuffer();
  return buffer;
}

async function get_key(): Promise<ArrayBuffer> {
  const key_buffer = await get_buffer(DEC_KEY_URL);
  return key_buffer;
}

function get_iv(playlist: string): Uint8Array | undefined {
  if (!playlist.includes("IV=")) {
    return undefined;
  }

  const iv_match = playlist.match(new RegExp("IV=0x(.+)"));
  if (!iv_match) {
    throw Error(`Expected to find IV value but got undefined`);
  }

  const iv_raw = iv_match[1];
  const bytes = new Uint8Array(16);
  for (let i = 0; i < iv_raw.length; i += 2) {
    bytes[i / 2] = parseInt(iv_raw.substring(i, i + 2), 16);
  }

  return new Uint8Array(bytes);
}

// TODO: Problem with decrypting
export async function download(
  master_playlist_url: string,
  return_type: "url" | "buffer"
): Promise<string | Buffer> {
  const master_playlist = await get(master_playlist_url);
  let playlist = ""
  try {
    playlist = await retrieve_video_playlist(master_playlist);
  } catch (e) {
    console.log("shit", e)
  }

  let segments: ArrayBuffer[] = [];
  const key = await get_key();
  const iv = get_iv(playlist);
  let require_decryption = true;
  if (!iv) {
    require_decryption = false;
  }

  let subtle: SubtleCrypto;
  let is_web = false;

  try {
    if (window && window.crypto) {
      is_web = true;
    }
  } catch (err) {}

  if (is_web) {
    subtle = window.crypto.subtle;
  } else {
    subtle = crypto.webcrypto.subtle;
  }

  const aes_key = await subtle.importKey(
    "raw",
    key,
    { name: "AES-CBC" },
    false,
    ["encrypt", "decrypt"]
  );

  const callbacks = [];
  let index = -1;
  const files_url = playlist
    .split("\n")
    .filter((line) => line.includes("https://") && line.includes(".ts"))
    .map((line) => line.trim());

  const parts = [];
  const part_size = Math.ceil(files_url.length / 10);
  for (let i = 0; i < files_url.length; i += part_size) {
    parts.push(files_url.slice(i, i + part_size));
  }

  for (const part of parts) {
    for (const file_url of part) {
      const content = {
        file_url,
        index: ++index,
      };
      const callback = /** @type {Promise<void>} */ new Promise(
        async (resolve) => {
          const file_enc = await get_buffer(content.file_url);

          if (require_decryption) {
            const file_buffer = new Uint8Array(file_enc);

            const file_dec_buffer = await subtle.decrypt(
              { name: "AES-CBC", iv: iv },
              aes_key,
              file_buffer.buffer
            );

            segments[content.index] = file_dec_buffer;
          } else {
            segments[content.index] = file_enc;
          }

          resolve(void 0);
        }
      );
      callbacks.push(callback);
    }
    await Promise.all(callbacks);
    callbacks.length = 0;
  }

  const blob = new Blob(segments);

  if (return_type === "url") {
    const url = URL.createObjectURL(blob);
    return url;
  }

  const movie_buffer = Buffer.from(
    new Uint8Array(await blob.arrayBuffer()).buffer
  );
  return movie_buffer;
}

export type { Movie, Season, Episode, Image };
