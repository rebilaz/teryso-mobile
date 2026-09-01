import { supabase } from './supabase';

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
  portfolioAssetId: string | null;
  symbol: string;
  name: string;
  assetType: string | null;
  quantity: number;
  gainPercent: number | null;
  allocationPercent: number | null;
};

export type PortfolioSnapshot = {
  currency: string;
  performance: number | null;
  assetsCount: number | null;
  holdings: SnapshotHolding[];
};

export type PublicChartPoint = {
  snapshotAt: string;
  totalValue: number;
  currency: string;
};

export type PublicDiscoverPortfolio =
  PublicPortfolio & {
    performance1M: number | null;
    performance3M: number | null;
    performanceMax: number | null;
    positionsCount: number;
    tradesMonth: number;
    volatility: number | null;
    chartPoints: PublicChartPoint[];
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

type DiscoverRow = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  description: string | null;
  base_currency: string;
  category_slug: string | null;
  governance_mode: string;
  updated_at: string | null;

  owner_username: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;

  followers: unknown;
  positions_count: unknown;
  trades_month: unknown;

  performance_1m: unknown;
  performance_3m: unknown;
  performance_max: unknown;
  volatility: unknown;

  chart_points: unknown;
};

type SupabaseFailure = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

function finiteNumber(
  value: unknown,
): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function integerOrZero(
  value: unknown,
) {
  const parsed =
    finiteNumber(value);

  if (
    parsed === null ||
    parsed <= 0
  ) {
    return 0;
  }

  return Math.trunc(
    parsed,
  );
}

function reportDataError(
  context: string,
  error: SupabaseFailure,
) {
  console.error(
    `[Teryso data] ${context}`,
    {
      code:
        error.code,

      message:
        error.message,

      details:
        error.details,

      hint:
        error.hint,
    },
  );
}

function normalizePortfolio(
  row: PortfolioRow,
  profiles: Map<
    string,
    ProfileRow
  >,
  followers: Map<
    string,
    number
  >,
): PublicPortfolio {
  const owner =
    profiles.get(
      row.user_id,
    );

  return {
    id:
      row.id,

    userId:
      row.user_id,

    slug:
      row.slug,

    name:
      row.name,

    description:
      row.description,

    baseCurrency:
      row.base_currency,

    categorySlug:
      row.category_slug,

    governanceMode:
      row.governance_mode,

    updatedAt:
      row.updated_at,

    followers:
      followers.get(
        row.user_id,
      ) ?? 0,

    owner:
      owner
        ? {
            id:
              owner.id,

            username:
              owner.username,

            displayName:
              owner.display_name,

            avatarUrl:
              owner.avatar_url,
          }
        : null,
  };
}

async function getPortfolioEnrichment(
  rows: PortfolioRow[],
) {
  const ownerIds = [
    ...new Set(
      rows.map(
        (row) =>
          row.user_id,
      ),
    ),
  ];

  const profiles =
    new Map<
      string,
      ProfileRow
    >();

  const followers =
    new Map<
      string,
      number
    >();

  if (
    ownerIds.length ===
    0
  ) {
    return {
      profiles,
      followers,
    };
  }

  const [
    profileResult,
    followResult,
  ] = await Promise.all([
    supabase
      .from(
        'profiles',
      )
      .select(
        'id,username,display_name,avatar_url',
      )
      .in(
        'id',
        ownerIds,
      ),

    supabase
      .from(
        'user_follows',
      )
      .select(
        'following_id',
      )
      .in(
        'following_id',
        ownerIds,
      ),
  ]);

  if (
    profileResult.error
  ) {
    reportDataError(
      'Chargement des profils publics',
      profileResult.error,
    );
  } else {
    for (
      const profile
      of (
        profileResult.data ??
        []
      ) as ProfileRow[]
    ) {
      profiles.set(
        profile.id,
        profile,
      );
    }
  }

  if (
    followResult.error
  ) {
    reportDataError(
      'Chargement des abonnés',
      followResult.error,
    );
  } else {
    for (
      const follow
      of (
        followResult.data ??
        []
      ) as FollowRow[]
    ) {
      followers.set(
        follow.following_id,
        (
          followers.get(
            follow.following_id,
          ) ?? 0
        ) + 1,
      );
    }
  }

  return {
    profiles,
    followers,
  };
}

function parseSnapshotHolding(
  value: unknown,
  index: number,
): SnapshotHolding {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value,
    )
  ) {
    throw new Error(
      `Holding invalide à l’index ${index}.`,
    );
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const symbol =
    typeof row.symbol ===
      'string'
      ? row.symbol.trim()
      : '';

  const quantity =
    finiteNumber(
      row.quantity,
    );

  if (!symbol) {
    throw new Error(
      `Holding sans symbole à l’index ${index}.`,
    );
  }

  if (
    quantity ===
    null
  ) {
    throw new Error(
      `Quantité invalide pour ${symbol}.`,
    );
  }

  return {
    portfolioAssetId:
      typeof row.portfolio_asset_id ===
        'string' &&
      row.portfolio_asset_id.trim()
        ? row.portfolio_asset_id
        : null,

    symbol,

    name:
      typeof row.name ===
        'string' &&
      row.name.trim()
        ? row.name
        : symbol,

    assetType:
      typeof row.asset_type ===
        'string' &&
      row.asset_type.trim()
        ? row.asset_type
        : null,

    quantity,

    gainPercent:
      finiteNumber(
        row.gain_percent,
      ),

    allocationPercent:
      finiteNumber(
        row.allocation_percent,
      ),
  };
}

function parsePublicChartPoints(
  value: unknown,
  fallbackCurrency: string,
): PublicChartPoint[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  const result:
    PublicChartPoint[] =
    [];

  for (
    const point
    of value
  ) {
    if (
      !point ||
      typeof point !==
        'object' ||
      Array.isArray(
        point,
      )
    ) {
      continue;
    }

    const row =
      point as Record<
        string,
        unknown
      >;

    const snapshotAt =
      typeof row.snapshot_at ===
        'string'
        ? row.snapshot_at
        : '';

    const totalValue =
      finiteNumber(
        row.total_value,
      );

    const date =
      new Date(
        snapshotAt,
      );

    if (
      !snapshotAt ||
      totalValue ===
        null ||
      Number.isNaN(
        date.getTime(),
      )
    ) {
      continue;
    }

    result.push({
      snapshotAt,

      totalValue,

      currency:
        typeof row.currency ===
          'string' &&
        row.currency.trim()
          ? row.currency
          : fallbackCurrency,
    });
  }

  result.sort(
    (
      left,
      right,
    ) =>
      new Date(
        left.snapshotAt,
      ).getTime() -
      new Date(
        right.snapshotAt,
      ).getTime(),
  );

  return result;
}

function normalizeDiscoverPortfolio(
  row: DiscoverRow,
): PublicDiscoverPortfolio {
  const baseCurrency =
    row.base_currency ||
    'EUR';

  const hasOwner =
    Boolean(
      row.owner_username ||
      row.owner_display_name ||
      row.owner_avatar_url,
    );

  return {
    id:
      row.id,

    userId:
      row.user_id,

    slug:
      row.slug,

    name:
      row.name,

    description:
      row.description ??
      '',

    baseCurrency,

    categorySlug:
      row.category_slug,

    governanceMode:
      row.governance_mode,

    updatedAt:
      row.updated_at,

    followers:
      integerOrZero(
        row.followers,
      ),

    owner:
      hasOwner
        ? {
            id:
              row.user_id,

            username:
              row.owner_username ??
              '',

            displayName:
              row.owner_display_name ??
              row.owner_username ??
              'Teryso',

            avatarUrl:
              row.owner_avatar_url,
          }
        : null,

    performance1M:
      finiteNumber(
        row.performance_1m,
      ),

    performance3M:
      finiteNumber(
        row.performance_3m,
      ),

    performanceMax:
      finiteNumber(
        row.performance_max,
      ),

    positionsCount:
      integerOrZero(
        row.positions_count,
      ),

    tradesMonth:
      integerOrZero(
        row.trades_month,
      ),

    volatility:
      finiteNumber(
        row.volatility,
      ),

    chartPoints:
      parsePublicChartPoints(
        row.chart_points,
        baseCurrency,
      ),
  };
}

export async function getPublicDiscoverPortfolios(
  limit = 30,
): Promise<
  PublicDiscoverPortfolio[]
> {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        Math.trunc(
          limit,
        ),
        100,
      ),
    );

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_public_discover_portfolios',
    {
      p_limit:
        safeLimit,
    },
  );

  if (error) {
    reportDataError(
      'Chargement des cartes publiques',
      error,
    );

    throw new Error(
      'Impossible de charger les données publiques des portefeuilles.',
    );
  }

  if (
    !Array.isArray(
      data,
    )
  ) {
    return [];
  }

  return (
    data as DiscoverRow[]
  ).map(
    normalizeDiscoverPortfolio,
  );
}

export async function getPublicPortfolios():
Promise<
  PublicPortfolio[]
> {
  const {
    data,
    error,
  } = await supabase
    .from(
      'portfolios',
    )
    .select(
      'id,user_id,slug,name,description,base_currency,category_slug,governance_mode,updated_at',
    )
    .eq(
      'is_public',
      true,
    )
    .order(
      'updated_at',
      {
        ascending:
          false,
      },
    );

  if (error) {
    reportDataError(
      'Chargement des portefeuilles publics',
      error,
    );

    throw new Error(
      'Impossible de charger les portefeuilles publics.',
    );
  }

  const rows =
    (
      data ??
      []
    ) as PortfolioRow[];

  const {
    profiles,
    followers,
  } =
    await getPortfolioEnrichment(
      rows,
    );

  return rows.map(
    (row) =>
      normalizePortfolio(
        row,
        profiles,
        followers,
      ),
  );
}

export async function getPublicPortfolioBySlug(
  slug: string,
): Promise<
  PublicPortfolio | null
> {
  const normalizedSlug =
    slug
      .trim()
      .toLowerCase();

  if (
    !normalizedSlug
  ) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      'portfolios',
    )
    .select(
      'id,user_id,slug,name,description,base_currency,category_slug,governance_mode,updated_at',
    )
    .eq(
      'is_public',
      true,
    )
    .eq(
      'slug',
      normalizedSlug,
    )
    .maybeSingle();

  if (error) {
    reportDataError(
      'Chargement du portefeuille public',
      error,
    );

    throw new Error(
      'Impossible de charger ce portefeuille.',
    );
  }

  if (!data) {
    return null;
  }

  const row =
    data as PortfolioRow;

  const {
    profiles,
    followers,
  } =
    await getPortfolioEnrichment(
      [
        row,
      ],
    );

  return normalizePortfolio(
    row,
    profiles,
    followers,
  );
}

export async function getPortfolioSnapshot(
  portfolioId: string,
): Promise<
  PortfolioSnapshot
> {
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_public_portfolio_snapshot',
    {
      p_portfolio_id:
        portfolioId,
    },
  );

  if (error) {
    reportDataError(
      'Chargement du snapshot public',
      error,
    );

    throw new Error(
      'Les données du portefeuille sont temporairement indisponibles.',
    );
  }

  if (!data) {
    throw new Error(
      'Le snapshot public est vide.',
    );
  }

  const source =
    (
      Array.isArray(
        data,
      )
        ? data[0]
        : data
    ) as
      | SnapshotRow
      | null;

  if (
    !source ||
    typeof source !==
      'object'
  ) {
    throw new Error(
      'Le format du snapshot public est invalide.',
    );
  }

  if (
    !Array.isArray(
      source.holdings,
    )
  ) {
    throw new Error(
      'La liste des positions du snapshot est invalide.',
    );
  }

  return {
    currency:
      typeof source.currency ===
        'string' &&
      source.currency.trim()
        ? source.currency
        : 'EUR',

    performance:
      finiteNumber(
        source.performance,
      ),

    assetsCount:
      finiteNumber(
        source.assets_count,
      ),

    holdings:
      source.holdings.map(
        parseSnapshotHolding,
      ),
  };
}
