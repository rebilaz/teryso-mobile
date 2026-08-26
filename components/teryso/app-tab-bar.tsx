import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
    useTerysoTheme,
} from '@/contexts/theme-context';

export type AppTabRouteName =
  | 'index'
  | 'discover'
  | 'portfolio'
  | 'account';

type IconName =
  ComponentProps<
    typeof Ionicons
  >['name'];

type TabItem = {
  route: AppTabRouteName;
  label: string;
  icon: IconName;
  activeIcon: IconName;
};

type AppTabBarProps = {
  activeRouteName: string;
  onNavigate: (
    route: AppTabRouteName,
  ) => void;
  onAdd: () => void;
};

const LEFT_ITEMS: TabItem[] = [
  {
    route: 'index',
    label: 'Accueil',
    icon: 'home-outline',
    activeIcon: 'home',
  },
  {
    route: 'discover',
    label: 'Découvrir',
    icon: 'compass-outline',
    activeIcon: 'compass',
  },
];

const RIGHT_ITEMS: TabItem[] = [
  {
    route: 'portfolio',
    label: 'Portefeuille',
    icon: 'pie-chart-outline',
    activeIcon: 'pie-chart',
  },
  {
    route: 'account',
    label: 'Profil',
    icon: 'person-circle-outline',
    activeIcon: 'person-circle',
  },
];

type NavigationButtonProps = {
  active: boolean;
  item: TabItem;
  onPress: () => void;
};

function NavigationButton({
  active,
  item,
  onPress,
}: NavigationButtonProps) {
  const { colors } =
    useTerysoTheme();

  const color = active
    ? colors.text
    : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        selected: active,
      }}
      accessibilityLabel={item.label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navigationButton,
        {
          opacity: pressed
            ? 0.55
            : 1,
        },
      ]}
    >
      <Ionicons
        name={
          active
            ? item.activeIcon
            : item.icon
        }
        size={24}
        color={color}
      />

      <Text
        numberOfLines={1}
        style={[
          styles.navigationLabel,
          {
            color,
          },
          active &&
            styles.navigationLabelActive,
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

export function AppTabBar({
  activeRouteName,
  onNavigate,
  onAdd,
}: AppTabBarProps) {
  const { colors } =
    useTerysoTheme();

  const insets =
    useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            colors.tabBar,

          borderTopColor:
            colors.border,

          paddingBottom:
            Math.max(
              insets.bottom,
              9,
            ),
        },
      ]}
    >
      <View style={styles.side}>
        {LEFT_ITEMS.map(
          (item) => (
            <NavigationButton
              key={item.route}
              active={
                activeRouteName ===
                item.route
              }
              item={item}
              onPress={() =>
                onNavigate(
                  item.route,
                )
              }
            />
          ),
        )}
      </View>

      <View style={styles.addSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter une transaction"
          onPress={onAdd}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor:
                colors.brandFill,

              borderColor:
                colors.page,

              opacity: pressed
                ? 0.72
                : 1,
            },
          ]}
        >
          <Ionicons
            name="add"
            size={32}
            color={
              colors.brandText
            }
          />
        </Pressable>

        <Text
          style={[
            styles.addLabel,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          Ajouter
        </Text>
      </View>

      <View style={styles.side}>
        {RIGHT_ITEMS.map(
          (item) => (
            <NavigationButton
              key={item.route}
              active={
                activeRouteName ===
                item.route
              }
              item={item}
              onPress={() =>
                onNavigate(
                  item.route,
                )
              }
            />
          ),
        )}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      alignItems: 'flex-end',
      borderTopWidth: 1,
      flexDirection: 'row',
      minHeight: 67,
      paddingHorizontal: 6,
      paddingTop: 7,
    },

    side: {
      flex: 2,
      flexDirection: 'row',
    },

    navigationButton: {
      alignItems: 'center',
      flex: 1,
      gap: 4,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 2,
    },

    navigationLabel: {
      fontSize: 9,
      fontWeight: '700',
    },

    navigationLabelActive: {
      fontWeight: '900',
    },

    addSlot: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      width: 72,
    },

    addButton: {
      alignItems: 'center',
      borderRadius: 31,
      borderWidth: 4,
      elevation: 8,
      height: 62,
      justifyContent: 'center',
      marginTop: -29,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.16,
      shadowRadius: 8,

      width: 62,
    },

    addLabel: {
      fontSize: 9,
      fontWeight: '700',
      marginTop: 2,
    },
  });