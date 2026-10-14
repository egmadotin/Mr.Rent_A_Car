import { createCaller, createContext } from "./index";

/** Server-side caller for React Server Components. Pass the incoming request headers. */
export async function serverApi(headers: Headers) {
  return createCaller(await createContext({ headers }));
}
