import AsyncStorage from '@react-native-async-storage/async-storage';
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

const LAST_PORTFOLIO_KEY_PREFIX =
  'teryso:last-opened-portfolio:';

function getLastPortfolioStorageKey(
  userId: string,
) {
  return `${LAST_PORTFOLIO_KEY_PREFIX}${userId}`;
}

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

  const saveLastPortfolio =
    useCallback(
      async (
        portfolioId: string,
      ) => {
        const userId =
          session?.user.id;

        if (!userId) {
          return;
        }

        try {
          await AsyncStorage.setItem(
            getLastPortfolioStorageKey(
              userId,
            ),
            portfolioId,
          );
        } catch (
          storageError
        ) {
          console.warn(
            '[PortfolioSwipe] Impossible de mémoriser le dernier portefeuille.',
            storageError,
          );
        }
      },
      [
        session?.user.id,
      ],
    );

  const selectPortfolio =
    useCallback(
      (
        portfolioId: string,
      ) => {
        setSelectedPortfolioId(
          portfolioId,
        );

        void saveLastPortfolio(
          portfolioId,
        );
      },
      [
        saveLastPortfolio,
      ],
    );

  const loadPortfolios =
    useCallback(
      async () => {
        const userId =
          session?.user.id;

        if (!userId) {
          setPortfolios([]);
          setSelectedPortfolioId(
            null,
          );
          setLoadingPortfolios(
            false,
          );

          return;
        }

        setPortfolioError(
          null,
        );

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                'portfolios',
              )
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
                  ascending:
                    true,
                },
              );

          if (error) {
            throw error;
          }

          const rows:
            MobilePortfolio[] =
            (data ?? []).map(
              (
                portfolio,
              ) => ({
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

          let storedPortfolioId:
            string | null =
            null;

          try {
            storedPortfolioId =
              await AsyncStorage.getItem(
                getLastPortfolioStorageKey(
                  userId,
                ),
              );
          } catch (
            storageError
          ) {
            console.warn(
              '[PortfolioSwipe] Impossible de lire le dernier portefeuille.',
              storageError,
            );
          }

          const requestedExists =
            Boolean(
              requestedPortfolioId &&
                rows.some(
                  (
                    portfolio,
                  ) =>
                    portfolio.id ===
                    requestedPortfolioId,
                ),
            );

          const storedExists =
            Boolean(
              storedPortfolioId &&
                rows.some(
                  (
                    portfolio,
                  ) =>
                    portfolio.id ===
                    storedPortfolioId,
                ),
            );

          const preferredPortfolioId =
            requestedExists
              ? requestedPortfolioId!
              : storedExists
                ? storedPortfolioId!
                : rows[0]?.id ??
                  null;

          setPortfolios(
            rows,
          );

          setSelectedPortfolioId(
            preferredPortfolioId,
          );

          if (
            preferredPortfolioId
          ) {
            void AsyncStorage.setItem(
              getLastPortfolioStorageKey(
                userId,
              ),
              preferredPortfolioId,
            ).catch(
              (
                storageError,
              ) => {
                console.warn(
                  '[PortfolioSwipe] Impossible de mémoriser le portefeuille prioritaire.',
                  storageError,
                );
              },
            );
          } else {
            void AsyncStorage.removeItem(
              getLastPortfolioStorageKey(
                userId,
              ),
            ).catch(
              (
                storageError,
              ) => {
                console.warn(
                  '[PortfolioSwipe] Impossible de nettoyer le portefeuille mémorisé.',
                  storageError,
                );
              },
            );
          }
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
          setLoadingPortfolios(
            false,
          );
        }
      },
      [
        requestedPortfolioId,
        session?.user.id,
      ],
    );

  useEffect(() => {
    setLoadingPortfolios(
      true,
    );

    void loadPortfolios();
  }, [
    loadPortfolios,
    refreshKey,
  ]);

  const selectedPortfolio =
    useMemo(
      () =>
        portfolios.find(
          (
            portfolio,
          ) =>
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

        selectPortfolio,

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
        selectPortfolio,
        loadPortfolios,
      ],
    );

  return (
    <PortfolioSwipeContext.Provider
      value={
        value
      }
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
