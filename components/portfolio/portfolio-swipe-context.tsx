import {
  useLocalSearchParams,
} from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useAuth,
} from '@/contexts/auth-context';
import {
  supabase,
} from '@/lib/supabase';

export type MobilePortfolio = {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_currency: string;
  is_public: boolean;
  governance_mode:
    | 'owner'
    | 'assembly';
  user_id: string;
};

type PortfolioSwipeContextValue = {
  portfolios:
    MobilePortfolio[];

  selectedPortfolioId:
    string | null;

  selectedPortfolio:
    MobilePortfolio | null;

  loadingPortfolios:
    boolean;

  portfolioError:
    string | null;

  refreshKey:
    string;

  selectPortfolio: (
    portfolioId: string,
  ) => void;

  refreshPortfolios:
    () => Promise<void>;
};

const PortfolioSwipeContext =
  createContext<
    PortfolioSwipeContextValue | null
  >(null);

export function PortfolioSwipeProvider({
  children,
}: PropsWithChildren) {
  const {
    session,
  } = useAuth();

  const params =
    useLocalSearchParams<{
      portfolioId?: string;
      refresh?: string;
    }>();

  const [
    portfolios,
    setPortfolios,
  ] =
    useState<
      MobilePortfolio[]
    >([]);

  const [
    selectedPortfolioId,
    setSelectedPortfolioId,
  ] =
    useState<
      string | null
    >(null);

  const [
    loadingPortfolios,
    setLoadingPortfolios,
  ] =
    useState(true);

  const [
    portfolioError,
    setPortfolioError,
  ] =
    useState<
      string | null
    >(null);

  const requestedPortfolioId =
    Array.isArray(
      params.portfolioId,
    )
      ? params.portfolioId[0]
      : params.portfolioId;

  const refreshKey =
    Array.isArray(
      params.refresh,
    )
      ? params.refresh[0] ?? ''
      : params.refresh ?? '';

  const loadPortfolios =
    useCallback(
      async () => {
        const userId =
          session?.user.id;

        if (!userId) {
          setPortfolios([]);
          setSelectedPortfolioId(null);
          setLoadingPortfolios(false);

          return;
        }

        setPortfolioError(null);

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from('portfolios')
              .select(
                'id,name,slug,description,base_currency,is_public,governance_mode,user_id',
              )
              .eq(
                'user_id',
                userId,
              )
              .order(
                'created_at',
                {
                  ascending: true,
                },
              );

          if (error) {
            throw error;
          }

          const rows:
            MobilePortfolio[] =
            (data ?? []).map(
              (portfolio) => ({
                id:
                  portfolio.id,

                name:
                  portfolio.name,

                slug:
                  portfolio.slug,

                description:
                  portfolio.description ??
                  '',

                base_currency:
                  portfolio.base_currency ??
                  'EUR',

                is_public:
                  Boolean(
                    portfolio.is_public,
                  ),

                governance_mode:
                  portfolio.governance_mode ===
                  'assembly'
                    ? 'assembly'
                    : 'owner',

                user_id:
                  portfolio.user_id,
              }),
            );

          setPortfolios(rows);

          setSelectedPortfolioId(
            (current) => {
              if (
                requestedPortfolioId &&
                rows.some(
                  (portfolio) =>
                    portfolio.id ===
                    requestedPortfolioId,
                )
              ) {
                return requestedPortfolioId;
              }

              if (
                current &&
                rows.some(
                  (portfolio) =>
                    portfolio.id ===
                    current,
                )
              ) {
                return current;
              }

              return (
                rows[0]?.id ??
                null
              );
            },
          );
        } catch (
          loadError
        ) {
          console.error(
            '[PortfolioSwipe]',
            loadError,
          );

          setPortfolioError(
            loadError instanceof Error
              ? loadError.message
              : 'Impossible de charger les portefeuilles.',
          );
        } finally {
          setLoadingPortfolios(false);
        }
      },
      [
        requestedPortfolioId,
        session?.user.id,
      ],
    );

  useEffect(() => {
    setLoadingPortfolios(true);

    void loadPortfolios();
  }, [
    loadPortfolios,
    refreshKey,
  ]);

  const selectedPortfolio =
    useMemo(
      () =>
        portfolios.find(
          (portfolio) =>
            portfolio.id ===
            selectedPortfolioId,
        ) ??
        null,
      [
        portfolios,
        selectedPortfolioId,
      ],
    );

  const value =
    useMemo<
      PortfolioSwipeContextValue
    >(
      () => ({
        portfolios,
        selectedPortfolioId,
        selectedPortfolio,
        loadingPortfolios,
        portfolioError,
        refreshKey,

        selectPortfolio:
          setSelectedPortfolioId,

        refreshPortfolios:
          loadPortfolios,
      }),
      [
        portfolios,
        selectedPortfolioId,
        selectedPortfolio,
        loadingPortfolios,
        portfolioError,
        refreshKey,
        loadPortfolios,
      ],
    );

  return (
    <PortfolioSwipeContext.Provider
      value={value}
    >
      {children}
    </PortfolioSwipeContext.Provider>
  );
}

export function usePortfolioSwipe() {
  const context =
    useContext(
      PortfolioSwipeContext,
    );

  if (!context) {
    throw new Error(
      'usePortfolioSwipe doit être utilisé dans PortfolioSwipeProvider.',
    );
  }

  return context;
}