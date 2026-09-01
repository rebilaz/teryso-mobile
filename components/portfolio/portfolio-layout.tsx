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
  } = useTerysoTheme();

  const {
    width,
  } = useWindowDimensions();

  const {
    portfolios,
    selectedPortfolio,
    selectedPortfolioId,
    selectPortfolio,
    loadingPortfolios,
  } = usePortfolioSwipe();

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
  ] = useState(0);

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    menuAnchor,
    setMenuAnchor,
  ] = useState<MenuAnchor | null>(
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
    setActiveIndex(
      index,
    );

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
    if (
      width <=
      0
    ) {
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

        setMenuOpen(
          true,
        );
      },
    );
  }

  function choosePortfolio(
    portfolioId: string,
  ) {
    selectPortfolio(
      portfolioId,
    );

    setMenuOpen(
      false,
    );

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
        6
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
              accessibilityState={{
                expanded:
                  menuOpen,
              }}
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
                      ? 0.7
                      : 1,
                },
              ]}
            >
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
                  name={
                    menuOpen
                      ? 'chevron-up'
                      : 'chevron-down'
                  }
                  size={
                    16
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
                contentContainerStyle={
                  styles.dropdownContent
                }
                style={
                  styles.dropdownScroll
                }
              >
                {portfolios.map(
                  (
                    portfolio,
                  ) => {
                    const active =
                      portfolio.id ===
                      selectedPortfolioId;

                    return (
                      <Pressable
                        key={
                          portfolio.id
                        }
                        accessibilityRole="button"
                        accessibilityState={{
                          selected:
                            active,
                        }}
                        onPress={() =>
                          choosePortfolio(
                            portfolio.id,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.dropdownItem,
                          {
                            backgroundColor:
                              active
                                ? colors.surfaceStrong
                                : 'transparent',
                            opacity:
                              pressed
                                ? 0.62
                                : 1,
                          },
                        ]}
                      >
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
                              active &&
                                styles.dropdownNameActive,
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

                        <View
                          style={
                            styles.dropdownCheck
                          }
                        >
                          {active ? (
                            <Ionicons
                              name="checkmark"
                              size={
                                18
                              }
                              color={
                                colors.text
                              }
                            />
                          ) : null}
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
        10,
      paddingHorizontal:
        20,
      paddingTop:
        10,
    },

    selector: {
      alignItems:
        'center',
      borderRadius:
        12,
      borderWidth:
        StyleSheet.hairlineWidth,
      flexDirection:
        'row',
      minHeight:
        48,
      paddingHorizontal:
        14,
      paddingVertical:
        8,
    },

    selectorCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingRight:
        12,
    },

    selectorName: {
      fontSize:
        13,
      fontWeight:
        '700',
    },

    selectorMeta: {
      fontSize:
        9,
      fontWeight:
        '500',
      marginTop:
        2,
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
        14,
      borderWidth:
        StyleSheet.hairlineWidth,
      elevation:
        10,
      maxHeight:
        300,
      overflow:
        'hidden',
      position:
        'absolute',
      shadowColor:
        '#000000',
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity:
        0.12,
      shadowRadius:
        14,
    },

    dropdownScroll: {
      maxHeight:
        298,
    },

    dropdownContent: {
      padding:
        6,
    },

    dropdownItem: {
      alignItems:
        'center',
      borderRadius:
        10,
      flexDirection:
        'row',
      minHeight:
        52,
      paddingHorizontal:
        12,
      paddingVertical:
        7,
    },

    dropdownCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingRight:
        10,
    },

    dropdownName: {
      fontSize:
        13,
      fontWeight:
        '600',
    },

    dropdownNameActive: {
      fontWeight:
        '800',
    },

    dropdownMeta: {
      fontSize:
        9,
      fontWeight:
        '500',
      marginTop:
        2,
    },

    dropdownCheck: {
      alignItems:
        'center',
      height:
        24,
      justifyContent:
        'center',
      width:
        24,
    },
  });
