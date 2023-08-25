# SC Wrapper

Wrapper for streamingcommunity website (to get the url, send a random message to: https://t.me/BelloFigoIlRobot)

# API

_There are three main functions exposed:_

**It searches for a movie or tv show by its name**

```js
/**
 * @description It can match the exact name or, if exact and estimate are true, can estimate the match of the movie title relative to the name we're searching for
 */
async function search_movie(
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
): Promise<Movie[]>
```

**It gets a movie or episode watch playlist url that, for example, you can use in a player like [HLS Player](https://www.hlsplayer.org/)**

```js
async function get_playlist(
  options: {
    movie_id: Movie["id"];
  } & (
    | {
        episode_id: number;
      }
    | {
        episode_id?: undefined;
      }
  )
): Promise<string>
```

**It can generates a download link for a movie or episode or download it as a buffer that, for example, you can save in a file**

```js
async function download(
  master_playlist_url: string,
  return_type: "url" | "buffer"
): Promise<string | Buffer>
```
