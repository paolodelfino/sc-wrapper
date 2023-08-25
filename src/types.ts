export type Image = {
  type: "poster" | "background" | "cover" | "cover_mobile" | "logo";
  url: string;
};

export type Episode = {
  id: number;
  number: number;
  name: string;
  plot: string;
};

export type Season = {
  number: number;
  episodes: Episode[];
};

export type Movie = {
  seasons: Season[];
  is_series: boolean;
  slug: string;
  id: string;
  images: Image[];
  plot: string;
  friendly_name: string;
  scws_id: string;
  trailer_url: string | null;
  embed_trailer_url: string | null;
  score: string;
  release_date: string;
};
