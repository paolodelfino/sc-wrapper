export async function get(url: string, headers?: Headers): Promise<string> {
  const response = await fetch(url, {
    headers,
  }).catch((err) => {
    throw new Error(`While trying to get ${url}: ${err}`);
  });
  return response.text();
}

export function decode_utf8(utf8_encoded: string): string {
  return decode_with_table(utf8_encoded, {
    "\u00e8": "è",
    "\u0027": "'",
  });
}

export function decode_html(html_encoded: string): string {
  return decode_with_table(html_encoded, {
    "&quot;": '"',
    "&#39;": "'",
    "&amp;": "&",
  });
}

function decode_with_table(s: string, table: Record<string, string>): string {
  let replace = s;
  for (const key in table) {
    replace = replace.replace(new RegExp(key, "g"), table[key]);
  }
  return replace;
}

/**
 * @description It gets parts of page using a regex
 */
export async function get_of_page(
  url: string,
  regex: RegExp,
  groups: number[]
): Promise<string[]> {
  const parts: string[] = [];

  const raw = await get(url);
  const match = raw.match(regex);
  if (!match) {
    throw new Error(
      `Expected data from regex match but got null: page(${url}), regex(${regex.source}), groups(${groups})`
    );
  }

  groups.forEach((group) => {
    if (!match[group]) {
      throw new Error(
        `Expected data from group but got null: page(${url}), regex(${regex.source}), group(${group})`
      );
    }

    parts.push(decode_utf8(decode_html(match[group])));
  });

  return parts;
}

/**
 * @description a occurrences in b
 */
export function compare_strings(a: string, b: string) {
  const aParts = a.toLowerCase().split(" ");
  const bParts = b.toLowerCase().split(" ");

  let matches = 0;
  for (const aPart of aParts) {
    for (const bPart of bParts) {
      if (aPart === bPart) {
        matches++;
      }
    }
  }

  return {
    equal: aParts.length === matches,
    matches,
    maxMatches: aParts.length,
  };
}

export function array_insert(array: any[], index: number, element: any) {
  array.splice(index, 0, element);
}
