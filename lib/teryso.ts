import { supabase } from '@/lib/supabase';

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type PublicPortfolio = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description: string;
  baseCurrency: string;
  categorySlug: string | null;
  governanceMode: string;
  updatedAt: string | null;
  followers: number;
  owner: PublicProfile | null;
};

export type SnapshotHolding = {
  symbol: string;
  name: string;
  allocationPercent: number | null;
};

export type PortfolioSnapshot = {
  currency: string;
  performance: number | null;
  assetsCount: number | null;
  holdings: SnapshotHolding[];
};

type PortfolioRow = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  description: string;
  base_currency: string;
  category_slug: string | null;
  governance_mode: string;
  updated_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type FollowRow = {
  following_id: string;
};

type SnapshotRow = {
  currency?: unknown;
  performance?: unknown;
  assets_count?: unknown;
  holdings?: unknown;
};

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePortfolio(
  row: PortfolioRow,
  profiles: Map<string, ProfileRow>,
  followers: Map<string, number>,
): PublicPortfolio {
  const owner = profiles.get(row.user_id);

  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    baseCurrency: row.base_currency,
    categorySlug: row.category_slug,
    governanceMode: row.governance_mode,
    updatedAt: row.updated_at,
    followers: followers.get(row.user_id) ?? 0,
    owner: owner
      ? {
          id: owner.id,
          username: owner.username,
          displayName: owner.display_name,
          avatarUrl: owner.avatar_url,
        }
      : null,
  };
}

export async function getPublicPortfolios(): Promise<PublicPortfolio[]> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('id,user_id,slug,name,description,base_currency,category_slug,governance_mode,updated_at')
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as PortfolioRow[];
  const ownerIds = [...new Set(rows.map((row) => row.user_id))];

  if (ownerIds.length === 0) return [];

  const [profileResult, followResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url')
      .in('id', ownerIds),
    supabase.from('user_follows').select('following_id').in('following_id', ownerIds),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (followResult.error) throw followResult.error;

  const profiles = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );
  const followers = new Map<string, number>();

  for (const follow of (followResult.data ?? []) as FollowRow[]) {
    followers.set(follow.following_id, (followers.get(follow.following_id) ?? 0) + 1);
  }

  return rows.map((row) => normalizePortfolio(row, profiles, followers));
}

export async function getPublicPortfolioBySlug(slug: string): Promise<PublicPortfolio | null> {
  const portfolios = await getPublicPortfolios();
  return portfolios.find((portfolio) => portfolio.slug === slug) ?? null;
}

export async function getPortfolioSnapshot(portfolioId: string): Promise<PortfolioSnapshot | null> {
  const { data, error } = await supabase.rpc('get_public_portfolio_snapshot', {
    p_portfolio_id: portfolioId,
  });

  if (error || !data) return null;

  const source = (Array.isArray(data) ? data[0] : data) as SnapshotRow | null;
  if (!source) return null;

  const rawHoldings = Array.isArray(source.holdings) ? source.holdings : [];
  const holdings = rawHoldings.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : '';
    if (!symbol) return [];

    return [
      {
        symbol,
        name: typeof row.name === 'string' && row.name.trim() ? row.name : symbol,
        allocationPercent: finiteNumber(row.allocation_percent),
      },
    ];
  });

  return {
    currency: typeof source.currency === 'string' ? source.currency : 'EUR',
    performance: finiteNumber(source.performance),
    assetsCount: finiteNumber(source.assets_count),
    holdings,
  };
}
