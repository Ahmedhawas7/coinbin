"use client";

import { OnchainKitProvider } from "@coinbase/onchainkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base } from "wagmi/chains";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { type ReactNode } from "react";
import { UIProvider, useUI } from "@/context/UIContext";

const queryClient = new QueryClient();

function OnchainKitWrapper({ children }: { children: ReactNode }) {
  const { theme } = useUI();
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{ appearance: { mode: theme } }}
    >
      {children}
    </OnchainKitProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UIProvider>
          <OnchainKitWrapper>
            {children}
          </OnchainKitWrapper>
        </UIProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
