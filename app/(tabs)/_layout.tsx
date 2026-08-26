import {
  Tabs,
  useRouter,
} from 'expo-router';
import {
  useState,
} from 'react';

import {
  AppTabBar,
} from '@/components/teryso/app-tab-bar';
import {
  TransactionSheet,
} from '@/components/teryso/transaction-sheet';

export default function TabLayout() {
  const router =
    useRouter();

  const [
    transactionSheetOpen,
    setTransactionSheetOpen,
  ] = useState(false);

  return (
    <>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard:
            true,
        }}
        tabBar={({
          state,
          navigation,
        }) => (
          <AppTabBar
            activeRouteName={
              state.routes[
                state.index
              ]?.name ??
              'index'
            }
            onNavigate={(
              route,
            ) => {
              navigation.navigate(
                route,
              );
            }}
            onAdd={() => {
              setTransactionSheetOpen(
                true,
              );
            }}
          />
        )}
      >
        <Tabs.Screen
          name="index"
          options={{
            title:
              'Accueil',
          }}
        />

        <Tabs.Screen
          name="discover"
          options={{
            title:
              'Découvrir',
          }}
        />

        <Tabs.Screen
          name="portfolio"
          options={{
            title:
              'Portefeuille',
          }}
        />

        <Tabs.Screen
          name="account"
          options={{
            title:
              'Profil',
          }}
        />
      </Tabs>

      <TransactionSheet
        visible={
          transactionSheetOpen
        }
        onClose={() =>
          setTransactionSheetOpen(
            false,
          )
        }
        onCreated={(
          portfolioId,
        ) => {
          setTransactionSheetOpen(
            false,
          );

          /*
           * Après l'opération,
           * on ouvre le portefeuille
           * concerné et on force son
           * rafraîchissement.
           */
          router.replace({
            pathname:
              '/portfolio',

            params: {
              portfolioId,

              refresh:
                String(
                  Date.now(),
                ),
            },
          });
        }}
      />
    </>
  );
}