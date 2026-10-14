"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { transformer } from "./transformer";
import type { AppRouter } from "./index";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } });
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (isServer) return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}

/** Wrap a surface (ERP or public) once, in its layout. Same client for web today and Expo later. */
export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = React.useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({ enabled: (op) => process.env.NODE_ENV === "development" && op.direction === "down" && op.result instanceof Error }),
        httpBatchLink({ url: "/api/trpc", transformer }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
