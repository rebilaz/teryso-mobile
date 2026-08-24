import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    BrandHeader,
} from '@/components/teryso/brand-header';
import {
    useAuth,
} from '@/contexts/auth-context';
import {
    useTerysoTheme,
} from '@/contexts/theme-context';
import {
    supabase,
} from '@/lib/supabase';

type AuthMode =
  | 'signin'
  | 'signup';

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return (
    'Une erreur inattendue est survenue.'
  );
}

export default function LoginScreen() {
  const { colors } =
    useTerysoTheme();

  const {
    signInWithGoogle,
  } = useAuth();

  const [mode, setMode] =
    useState<AuthMode>('signin');

  const [email, setEmail] =
    useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    googleLoading,
    setGoogleLoading,
  ] = useState(false);

  async function handleGoogle() {
    if (
      googleLoading ||
      submitting
    ) {
      return;
    }

    setGoogleLoading(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(
        'Erreur Google OAuth :',
        error,
      );

      Alert.alert(
        'Connexion Google impossible',
        getErrorMessage(error),
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleEmailAuth() {
    const cleanEmail =
      email.trim();

    if (!cleanEmail) {
      Alert.alert(
        'Email requis',
        'Saisissez votre adresse email.',
      );

      return;
    }

    if (
      password.length < 6
    ) {
      Alert.alert(
        'Mot de passe trop court',
        'Le mot de passe doit contenir au moins 6 caractères.',
      );

      return;
    }

    setSubmitting(true);

    try {
      if (
        mode === 'signin'
      ) {
        const { error } =
          await supabase.auth
            .signInWithPassword({
              email: cleanEmail,
              password,
            });

        if (error) {
          throw error;
        }

        return;
      }

      const { data, error } =
        await supabase.auth
          .signUp({
            email:
              cleanEmail,

            password,
          });

      if (error) {
        throw error;
      }

      /*
       * Si la confirmation email
       * Supabase est activée, aucune
       * session n'est encore créée.
       */
      if (!data.session) {
        Alert.alert(
          'Confirmez votre email',
          'Un email de confirmation vient de vous être envoyé. Après confirmation, revenez dans Teryso pour vous connecter.',
        );
      }
    } catch (error) {
      console.error(
        'Erreur authentification email :',
        error,
      );

      Alert.alert(
        mode === 'signin'
          ? 'Connexion impossible'
          : 'Création du compte impossible',

        getErrorMessage(error),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const busy =
    submitting ||
    googleLoading;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.page,
        },
      ]}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          <BrandHeader
            eyebrow="Bienvenue"
            title="Connectez-vous à Teryso"
          />

          <Text
            style={[
              styles.intro,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            Un compte est nécessaire
            pour accéder à Teryso.
            Vos portefeuilles et votre
            session sont synchronisés
            avec votre compte.
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  colors.surface,

                borderColor:
                  colors.border,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                void handleGoogle()
              }
              style={({ pressed }) => [
                styles.googleButton,

                {
                  borderColor:
                    colors.borderStrong,

                  backgroundColor:
                    colors.surfaceStrong,

                  opacity:
                    pressed ||
                    busy
                      ? 0.65
                      : 1,
                },
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator
                  color={colors.text}
                />
              ) : (
                <>
                  <Ionicons
                    name="logo-google"
                    size={21}
                    color={colors.text}
                  />

                  <Text
                    style={[
                      styles.googleText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Continuer avec Google
                  </Text>
                </>
              )}
            </Pressable>

            <View
              style={
                styles.separatorRow
              }
            >
              <View
                style={[
                  styles.separator,
                  {
                    backgroundColor:
                      colors.border,
                  },
                ]}
              />

              <Text
                style={[
                  styles.separatorText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                ou
              </Text>

              <View
                style={[
                  styles.separator,
                  {
                    backgroundColor:
                      colors.border,
                  },
                ]}
              />
            </View>

            <View
              style={[
                styles.segment,
                {
                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  setMode(
                    'signin',
                  )
                }
                style={[
                  styles.segmentButton,

                  mode ===
                    'signin' && {
                    backgroundColor:
                      colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,

                    {
                      color:
                        mode ===
                        'signin'
                          ? colors.text
                          : colors.textMuted,
                    },
                  ]}
                >
                  Connexion
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  setMode(
                    'signup',
                  )
                }
                style={[
                  styles.segmentButton,

                  mode ===
                    'signup' && {
                    backgroundColor:
                      colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,

                    {
                      color:
                        mode ===
                        'signup'
                          ? colors.text
                          : colors.textMuted,
                    },
                  ]}
                >
                  Créer un compte
                </Text>
              </Pressable>
            </View>

            <Text
              style={[
                styles.label,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Email
            </Text>

            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!busy}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="vous@exemple.com"
              placeholderTextColor={
                colors.textMuted
              }
              style={[
                styles.input,
                {
                  borderColor:
                    colors.border,

                  color:
                    colors.text,
                },
              ]}
              value={email}
            />

            <Text
              style={[
                styles.label,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Mot de passe
            </Text>

            <TextInput
              autoCapitalize="none"
              autoComplete={
                mode === 'signin'
                  ? 'current-password'
                  : 'new-password'
              }
              editable={!busy}
              onChangeText={
                setPassword
              }
              placeholder="6 caractères minimum"
              placeholderTextColor={
                colors.textMuted
              }
              secureTextEntry
              style={[
                styles.input,
                {
                  borderColor:
                    colors.border,

                  color:
                    colors.text,
                },
              ]}
              value={password}
            />

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                void handleEmailAuth()
              }
              style={({ pressed }) => [
                styles.primaryButton,

                {
                  backgroundColor:
                    colors.brandFill,

                  opacity:
                    pressed ||
                    busy
                      ? 0.65
                      : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator
                  color={
                    colors.brandText
                  }
                />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color:
                        colors.brandText,
                    },
                  ]}
                >
                  {mode === 'signin'
                    ? 'Se connecter'
                    : 'Créer mon compte'}
                </Text>
              )}
            </Pressable>

            <Text
              style={[
                styles.disclaimer,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              En continuant, vous
              acceptez les conditions
              générales et la politique
              de confidentialité de
              Teryso.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex: 1,
    },

    safeArea: {
      flex: 1,
    },

    content: {
      flexGrow: 1,
      paddingBottom: 36,
      paddingHorizontal: 18,
      paddingTop: 14,
    },

    intro: {
      fontSize: 14,
      lineHeight: 22,
      marginTop: 20,
      maxWidth: 500,
    },

    card: {
      borderRadius: 24,
      borderWidth: 1,
      marginTop: 24,
      padding: 20,
    },

    googleButton: {
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      height: 54,
      justifyContent: 'center',
    },

    googleText: {
      fontSize: 14,
      fontWeight: '800',
    },

    separatorRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginVertical: 22,
    },

    separator: {
      flex: 1,
      height: 1,
    },

    separatorText: {
      fontSize: 12,
      fontWeight: '700',
    },

    segment: {
      borderRadius: 13,
      flexDirection: 'row',
      padding: 4,
    },

    segmentButton: {
      alignItems: 'center',
      borderRadius: 10,
      flex: 1,
      paddingHorizontal: 8,
      paddingVertical: 10,
    },

    segmentText: {
      fontSize: 12,
      fontWeight: '800',
    },

    label: {
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 8,
      marginTop: 20,
    },

    input: {
      borderRadius: 14,
      borderWidth: 1,
      fontSize: 15,
      height: 52,
      paddingHorizontal: 14,
    },

    primaryButton: {
      alignItems: 'center',
      borderRadius: 14,
      height: 52,
      justifyContent: 'center',
      marginTop: 22,
    },

    primaryButtonText: {
      fontSize: 14,
      fontWeight: '900',
    },

    disclaimer: {
      fontSize: 11,
      lineHeight: 17,
      marginTop: 16,
      textAlign: 'center',
    },
  });