import superjson from "superjson";

/**
 * Prisma Decimal (decimal.js) → exact string on the wire. Detected by shape so this file can be
 * shared with the browser without bundling Prisma. Clients receive money as strings: format it,
 * don't do arithmetic on it — totals are computed on the server.
 */
type DecimalLike = { d: unknown; e: unknown; s: unknown; toFixed: () => string };

superjson.registerCustom<DecimalLike, string>(
  {
    isApplicable: (v): v is DecimalLike =>
      v !== null && typeof v === "object" && "d" in v && "e" in v && "s" in v && typeof (v as DecimalLike).toFixed === "function",
    serialize: (v) => v.toString(),
    deserialize: (v) => v as unknown as DecimalLike,
  },
  "decimal",
);

export const transformer = superjson;

/**
 * Client-side view of a router output: Decimal fields arrive as strings (see above).
 * Use for data received through tRPC on the client.
 */
export type Wire<T> = T extends { toFixed: (...a: never[]) => string; d: unknown }
  ? string
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? Wire<U>[]
      : T extends object
        ? { [K in keyof T]: Wire<T[K]> }
        : T;
