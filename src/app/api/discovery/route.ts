import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const account = searchParams.get("account");

  if (!account) {
    return NextResponse.json({ error: "No account provided" }, { status: 400 });
  }

  try {
    const addresses = new Set<string>();
    let nextPagePath: string | null = `/api/v2/addresses/${account}/token-balances`;
    
    // Safety limit to avoid infinite loops or memory explosions on huge wallets
    let pagesFetched = 0;
    while (nextPagePath && pagesFetched < 10) {
      const url = `https://base.blockscout.com${nextPagePath}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'CoinBin-Base-Cleaner/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) break;

      const data: any = await res.json();
      if (Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          if (item?.token?.address) {
            addresses.add(item.token.address.toLowerCase());
          }
        });
      }

      nextPagePath = data.next_page_params 
        ? `/api/v2/addresses/${account}/token-balances?` + new URLSearchParams(data.next_page_params).toString()
        : null;
      pagesFetched++;
    }

    return NextResponse.json({ tokens: Array.from(addresses) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
