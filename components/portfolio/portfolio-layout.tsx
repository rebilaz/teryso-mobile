import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import {
    useRef,
    useState,
} from 'react';
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native';
import {
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    AssemblySlide,
} from '@/components/portfolio/assembly-slide';
import {
    PortfolioSlide,
} from '@/components/portfolio/portfolio-slide';
import {
    usePortfolioSwipe,
} from '@/components/portfolio/portfolio-swipe-context';
import {
    RulesSlide,
} from '@/components/portfolio/rules-slide';
import {
    TransactionsSlide,
} from '@/components/portfolio/transactions-slide';
import {
    BrandHeader,
} from '@/components/teryso/brand-header';
import {
    useTerysoTheme,
} from '@/contexts/theme-context';

type SlideKey =
  | 'portfolio'
  | 'transactions'
  | 'assembly'
  | 'rules';

type MenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SLIDES: {
  key: SlideKey;
  label: string;
}[] = [
  {
    key: 'portfolio',
    label: 'Portefeuille',
  },
  {
    key: 'transactions',
    label: 'Transactions',
  },
  {
    key: 'assembly',
    label: 'Assemblée',
  },
  {
    key: 'rules',
    label: 'Règles',
  },
];

export function PortfolioLayout() {
  const {
    colors,
  } =
    useTerysoTheme();

  const {
    width,
  } =
    useWindowDimensions();

  const {
    portfolios,
    selectedPortfolio,
    selectedPortfolioId,
    selectPortfolio,
    loadingPortfolios,
  } =
    usePortfolioSwipe();

  const pagerRef =
    useRef<ScrollView>(
      null,
    );

  const selectorRef =
    useRef<View>(
      null,
    );

  const scrollX =
    useRef(
      new Animated.Value(
        0,
      ),
    ).current;

  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(0);

  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(false);

  const [
    menuAnchor,
    setMenuAnchor,
  ] =
    useState<MenuAnchor | null>(
      null,
    );

  const tabWidth =
    width /
    SLIDES.length;

  const indicatorTranslate =
    scrollX.interpolate({
      inputRange: [
        0,
        width,
        width * 2,
        width * 3,
      ],

      outputRange: [
        0,
        tabWidth,
        tabWidth * 2,
        tabWidth * 3,
      ],

      extrapolate:
        'clamp',
    });

  function goToSlide(
    index: number,
  ) {
    setActiveIndex(index);

    pagerRef.current?.scrollTo({
      x:
        index *
        width,

      animated:
        true,
    });

    void Haptics.selectionAsync();
  }

  function handleMomentumEnd(
    event:
      NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    if (width <= 0) {
      return;
    }

    const nextIndex =
      Math.max(
        0,
        Math.min(
          SLIDES.length -
            1,

          Math.round(
            event
              .nativeEvent
              .contentOffset
              .x /
              width,
          ),
        ),
      );

    if (
      nextIndex !==
      activeIndex
    ) {
      setActiveIndex(
        nextIndex,
      );

      void Haptics.selectionAsync();
    }
  }

  function openPortfolioMenu() {
    if (
      loadingPortfolios ||
      portfolios.length ===
        0
    ) {
      return;
    }

    selectorRef.current?.measureInWindow(
      (
        x,
        y,
        measuredWidth,
        measuredHeight,
      ) => {
        setMenuAnchor({
          x,
          y,
          width:
            measuredWidth,
          height:
            measuredHeight,
        });

        setMenuOpen(true);
      },
    );
  }

  function choosePortfolio(
    portfolioId: string,
  ) {
    selectPortfolio(
      portfolioId,
    );

    setMenuOpen(false);

    void Haptics.selectionAsync();
  }

  const overlayWidth =
    menuAnchor
      ? Math.min(
          menuAnchor.width,
          width - 32,
        )
      : width - 32;

  const overlayLeft =
    menuAnchor
      ? Math.max(
          16,
          Math.min(
            menuAnchor.x,
            width -
              overlayWidth -
              16,
          ),
        )
      : 16;

  const overlayTop =
    menuAnchor
      ? menuAnchor.y +
        menuAnchor.height +
        7
      : 0;

  return (
    <SafeAreaView
      edges={[
        'top',
      ]}
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.page,
        },
      ]}
    >
      <View
        style={[
          styles.headerArea,
          {
            backgroundColor:
              colors.page,

            borderBottomColor:
              colors.border,
          },
        ]}
      >
        <View
          style={
            styles.headerPadding
          }
        >
          <BrandHeader
            eyebrow="Gestion"
            title="Portefeuille"
          />
        </View>

        <View
          style={[
            styles.tabs,
            {
              borderBottomColor:
                colors.border,
            },
          ]}
        >
          {SLIDES.map(
            (
              item,
              index,
            ) => {
              const active =
                activeIndex ===
                index;

              return (
                <Pressable
                  key={
                    item.key
                  }
                  accessibilityRole="tab"
                  accessibilityState={{
                    selected:
                      active,
                  }}
                  onPress={() =>
                    goToSlide(
                      index,
                    )
                  }
                  style={
                    styles.tab
                  }
                >
                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.tabText,
                      {
                        color:
                          active
                            ? colors.text
                            : colors.textMuted,
                      },

                      active &&
                        styles.tabTextActive,
                    ]}
                  >
                    {
                      item.label
                    }
                  </Text>
                </Pressable>
              );
            },
          )}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicatorSlot,
              {
                width:
                  tabWidth,

                transform: [
                  {
                    translateX:
                      indicatorTranslate,
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.indicator,
                {
                  backgroundColor:
                    colors.text,
                },
              ]}
            />
          </Animated.View>
        </View>

        <View
          style={
            styles.selectorWrapper
          }
        >
          <View
            ref={
              selectorRef
            }
            collapsable={
              false
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choisir un portefeuille"
              onPress={
                openPortfolioMenu
              }
              style={({
                pressed,
              }) => [
                styles.selector,
                {
                  backgroundColor:
                    colors.surface,

                  borderColor:
                    colors.border,

                  opacity:
                    pressed
                      ? 0.72
                      : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.selectorIcon,
                  {
                    backgroundColor:
                      colors.surfaceStrong,
                  },
                ]}
              >
                <Ionicons
                  name="wallet-outline"
                  size={
                    17
                  }
                  color={
                    colors.text
                  }
                />
              </View>

              <View
                style={
                  styles.selectorCopy
                }
              >
                <Text
                  numberOfLines={
                    1
                  }
                  style={[
                    styles.selectorName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {loadingPortfolios
                    ? 'Chargement…'
                    : selectedPortfolio
                        ?.name ??
                      'Aucun portefeuille'}
                </Text>

                {selectedPortfolio ? (
                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.selectorMeta,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {
                      selectedPortfolio.base_currency
                    }
                    {' · '}
                    {selectedPortfolio.governance_mode ===
                    'assembly'
                      ? 'Assemblée'
                      : 'Propriétaire'}
                  </Text>
                ) : null}
              </View>

              {portfolios.length >
              0 ? (
                <Ionicons
                  name="chevron-down"
                  size={
                    17
                  }
                  color={
                    colors.textMuted
                  }
                />
              ) : null}
            </Pressable>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        ref={
          pagerRef
        }
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        disableIntervalMomentum
        decelerationRate="fast"
        showsHorizontalScrollIndicator={
          false
        }
        keyboardDismissMode="on-drag"
        scrollEventThrottle={
          16
        }
        onScroll={Animated.event(
          [
            {
              nativeEvent: {
                contentOffset: {
                  x:
                    scrollX,
                },
              },
            },
          ],
          {
            useNativeDriver:
              true,
          },
        )}
        onMomentumScrollEnd={
          handleMomentumEnd
        }
        style={
          styles.pager
        }
      >
        <View
          style={[
            styles.slide,
            {
              width,
            },
          ]}
        >
          <PortfolioSlide />
        </View>

        <View
          style={[
            styles.slide,
            {
              width,
            },
          ]}
        >
          <TransactionsSlide />
        </View>

        <View
          style={[
            styles.slide,
            {
              width,
            },
          ]}
        >
          <AssemblySlide />
        </View>

        <View
          style={[
            styles.slide,
            {
              width,
            },
          ]}
        >
          <RulesSlide />
        </View>
      </Animated.ScrollView>

      <Modal
        visible={
          menuOpen
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setMenuOpen(
            false,
          )
        }
      >
        <View
          style={
            styles.modalRoot
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setMenuOpen(
                false,
              )
            }
          />

          {menuAnchor ? (
            <View
              style={[
                styles.dropdown,
                {
                  left:
                    overlayLeft,

                  top:
                    overlayTop,

                  width:
                    overlayWidth,

                  backgroundColor:
                    colors.surface,

                  borderColor:
                    colors.border,
                },
              ]}
            >
              <ScrollView
                showsVerticalScrollIndicator={
                  false
                }
                bounces={
                  false
                }
                style={
                  styles.dropdownScroll
                }
              >
                {portfolios.map(
                  (
                    portfolio,
                    index,
                  ) => {
                    const active =
                      portfolio.id ===
                      selectedPortfolioId;

                    return (
                      <Pressable
                        key={
                          portfolio.id
                        }
                        onPress={() =>
                          choosePortfolio(
                            portfolio.id,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.dropdownItem,

                          index <
                            portfolios.length -
                              1 && {
                            borderBottomColor:
                              colors.border,

                            borderBottomWidth:
                              StyleSheet.hairlineWidth,
                          },

                          {
                            backgroundColor:
                              active
                                ? colors.surfaceStrong
                                : colors.surface,

                            opacity:
                              pressed
                                ? 0.65
                                : 1,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.dropdownIcon,
                            {
                              backgroundColor:
                                active
                                  ? colors.brandFill
                                  : colors.surfaceStrong,
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              active
                                ? 'checkmark'
                                : 'wallet-outline'
                            }
                            size={
                              16
                            }
                            color={
                              active
                                ? colors.brandText
                                : colors.text
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.dropdownCopy
                          }
                        >
                          <Text
                            numberOfLines={
                              1
                            }
                            style={[
                              styles.dropdownName,
                              {
                                color:
                                  colors.text,
                              },
                            ]}
                          >
                            {
                              portfolio.name
                            }
                          </Text>

                          <Text
                            numberOfLines={
                              1
                            }
                            style={[
                              styles.dropdownMeta,
                              {
                                color:
                                  colors.textMuted,
                              },
                            ]}
                          >
                            {
                              portfolio.base_currency
                            }
                            {' · '}
                            {portfolio.governance_mode ===
                            'assembly'
                              ? 'Assemblée'
                              : 'Propriétaire'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  },
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    headerArea: {
      borderBottomWidth:
        StyleSheet.hairlineWidth,

      zIndex: 10,
    },

    headerPadding: {
      paddingHorizontal:
        20,

      paddingTop:
        14,
    },

    tabs: {
      borderBottomWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      marginTop:
        18,

      minHeight:
        46,

      position:
        'relative',
    },

    tab: {
      alignItems:
        'center',

      flex:
        1,

      justifyContent:
        'center',

      paddingHorizontal:
        3,
    },

    tabText: {
      fontSize:
        10,

      fontWeight:
        '700',
    },

    tabTextActive: {
      fontWeight:
        '900',
    },

    indicatorSlot: {
      alignItems:
        'center',

      bottom:
        0,

      height:
        3,

      justifyContent:
        'flex-end',

      left:
        0,

      position:
        'absolute',
    },

    indicator: {
      borderRadius:
        999,

      height:
        2.5,

      width:
        '58%',
    },

    selectorWrapper: {
      paddingBottom:
        11,

      paddingHorizontal:
        20,

      paddingTop:
        11,
    },

    selector: {
      alignItems:
        'center',

      borderRadius:
        14,

      borderWidth:
        1,

      flexDirection:
        'row',

      minHeight:
        54,

      paddingHorizontal:
        11,

      paddingVertical:
        8,
    },

    selectorIcon: {
      alignItems:
        'center',

      borderRadius:
        11,

      height:
        34,

      justifyContent:
        'center',

      width:
        34,
    },

    selectorCopy: {
      flex:
        1,

      marginLeft:
        10,

      minWidth:
        0,
    },

    selectorName: {
      fontSize:
        13,

      fontWeight:
        '900',
    },

    selectorMeta: {
      fontSize:
        9,

      fontWeight:
        '600',

      marginTop:
        3,
    },

    pager: {
      flex:
        1,
    },

    slide: {
      flex:
        1,
    },

    modalRoot: {
      flex:
        1,
    },

    dropdown: {
      borderRadius:
        15,

      borderWidth:
        1,

      elevation:
        14,

      maxHeight:
        290,

      overflow:
        'hidden',

      position:
        'absolute',

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 7,
      },

      shadowOpacity:
        0.18,

      shadowRadius:
        16,
    },

    dropdownScroll: {
      maxHeight:
        288,
    },

    dropdownItem: {
      alignItems:
        'center',

      flexDirection:
        'row',

      minHeight:
        61,

      paddingHorizontal:
        12,

      paddingVertical:
        9,
    },

    dropdownIcon: {
      alignItems:
        'center',

      borderRadius:
        10,

      height:
        34,

      justifyContent:
        'center',

      width:
        34,
    },

    dropdownCopy: {
      flex:
        1,

      marginLeft:
        10,

      minWidth:
        0,
    },

    dropdownName: {
      fontSize:
        13,

      fontWeight:
        '900',
    },

    dropdownMeta: {
      fontSize:
        9,

      marginTop:
        3,
    },
  });