import "@/augmentations";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import NetInfo from "@react-native-community/netinfo";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as BackgroundTask from "expo-background-task";
import * as Device from "expo-device";
import { Image } from "expo-image";
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Platform } from "react-native";
import { GlobalModal } from "@/components/GlobalModal";
import { PendingAccountSaveModal } from "@/components/PendingAccountSaveModal";
import { enableTVMenuKeyInterception } from "@/hooks/useTVBackHandler";
import i18n from "@/i18n";
import { DownloadProvider } from "@/providers/DownloadProvider";
import { GlobalModalProvider } from "@/providers/GlobalModalProvider";
import { InactivityProvider } from "@/providers/InactivityProvider";
import { IntroSheetProvider } from "@/providers/IntroSheetProvider";
import { apiAtom, JellyfinProvider } from "@/providers/JellyfinProvider";
import { MusicPlayerProvider } from "@/providers/MusicPlayerProvider";
import { NativePlayerProvider } from "@/providers/NativePlayerProvider";
import { NetworkStatusProvider } from "@/providers/NetworkStatusProvider";
import { PlaySettingsProvider } from "@/providers/PlaySettingsProvider";
import { ServerUrlProvider } from "@/providers/ServerUrlProvider";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { WifiSsidProvider } from "@/providers/WifiSsidProvider";
import { useSettings } from "@/utils/atoms/settings";
import {
  BACKGROUND_FETCH_TASK,
  BACKGROUND_FETCH_TASK_SESSIONS,
  registerBackgroundFetchAsyncSessions,
} from "@/utils/background-tasks";
import { getOrSetDeviceId } from "@/utils/device";
import {
  LogProvider,
  writeErrorLog,
  writeInfoLog,
  writeToLog,
} from "@/utils/log";
import { storage } from "@/utils/mmkv";

const Notifications = !Platform.isTV ? require("expo-notifications") : null;

import { getSessionApi } from "@jellyfin/sdk/lib/utils/api/session-api";
import { getLocales } from "expo-localization";
import type { EventSubscription } from "expo-modules-core";
import type {
  Notification,
  NotificationResponse,
} from "expo-notifications/build/Notifications.types";
import type { ExpoPushToken } from "expo-notifications/build/Tokens.types";
import { Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as TaskManager from "expo-task-manager";
import { Provider as JotaiProvider, useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { Appearance, LogBox } from "react-native";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Suppress harmless tvOS warning from react-native-gesture-handler
if (Platform.isTV) {
  LogBox.ignoreLogs(["HoverGestureHandler is not supported on tvOS"]);
}

import useRouter from "@/hooks/useAppRouter";
import { userAtom } from "@/providers/JellyfinProvider";
import { store as jotaiStore, store } from "@/utils/store";
import "react-native-reanimated";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { Toaster } from "sonner-native";

// 定义马卡龙浅色主题
const MacaronTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#FFFDF9", // 乳白色背景
    card: "#FFFFFF",
    text: "#4A4A4A",       // 护眼深灰字
    border: "#FFDAC1",     // 奶油黄边框点缀
    primary: "#FFB7B2",    // 柔粉主色
  },
};

// Disable strict mode warnings for reading shared values during render
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

if (!Platform.isTV) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Set the animation options.
SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

try {
  Image.configureCache({
    maxMemoryCost: Platform.isTV
      ? 8 * 1024 * 1024
      : 128 * 1024 * 1024,
    maxDiskSize: 200 * 1024 * 1024,
  });
} catch {
  // Safe to ignore
}

function useNotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.isTV) return;

    let isMounted = true;

    Notifications.getLastNotificationResponseAsync().then(
      (response: { notification: any }) => {
        if (!isMounted || !response?.notification) {
          return;
        }
        const url = response?.notification.request.content.data?.url;
        if (url) {
          router.push(url);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [router]);
}

if (!Platform.isTV) {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK_SESSIONS, async () => {
    const api = store.get(apiAtom);
    if (api === null || api === undefined) return;

    const response = await getSessionApi(api).getSessions({
      activeWithinSeconds: 360,
    });

    const result = response.data.filter((s) => s.NowPlayingItem);
    Notifications.setBadgeCountAsync(result.length);

    return BackgroundTask.BackgroundTaskResult.Success;
  });

  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    return BackgroundTask.BackgroundTaskResult.Success;
  });
}

const checkAndRequestPermissions = async () => {
  try {
    const hasAskedBefore = storage.getString(
      "hasAskedForNotificationPermission",
    );
    let granted = false;
    if (hasAskedBefore !== "true") {
      const { status } = await Notifications.requestPermissionsAsync();
      granted = status === "granted";
      storage.set("hasAskedForNotificationPermission", "true");
    } else {
      const { status } = await Notifications.getPermissionsAsync();
      granted = status === "granted";
    }
    return granted;
  } catch (error) {
    return false;
  }
};

export default function RootLayout() {
  // 切换系统为 Light 模式
  Appearance.setColorScheme("light");

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#FFFDF9" }}>
      <JotaiProvider store={jotaiStore}>
        <ActionSheetProvider>
          <I18nextProvider i18n={i18n}>
            <Layout />
          </I18nextProvider>
        </ActionSheetProvider>
      </JotaiProvider>
    </GestureHandlerRootView>
  );
}

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60 * 60 * 24,
      networkMode: "offlineFirst",
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: (failureCount) => {
        if (!onlineManager.isOnline()) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      networkMode: "online",
    },
  },
});

const mmkvPersister = createSyncStoragePersister({
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.remove(key),
  },
});

function Layout() {
  const { settings } = useSettings();
  const [user] = useAtom(userAtom);
  const [api] = useAtom(apiAtom);
  const _segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    enableTVMenuKeyInterception();
  }, []);

  useEffect(() => {
    i18n.changeLanguage(
      settings?.preferedLanguage ?? getLocales()[0].languageCode ?? "en",
    );
  }, [settings?.preferedLanguage, i18n]);

  useNotificationObserver();

  const [expoPushToken, setExpoPushToken] = useState<ExpoPushToken>();
  const notificationListener = useRef<EventSubscription>(null);
  const responseListener = useRef<EventSubscription>(null);

  useEffect(() => {
    if (!Platform.isTV && expoPushToken && api && user) {
      api
        ?.post("/Streamyfin/device", {
          token: expoPushToken.data,
          deviceId: getOrSetDeviceId(),
          userId: user.Id,
        })
        .catch((_) =>
          writeErrorLog("Failed to push expo push token to plugin"),
        );
    }
  }, [api, expoPushToken, user]);

  const registerNotifications = useCallback(async () => {
    if (Platform.OS === "android") {
      await Notifications?.setNotificationChannelAsync("default", {
        name: "default",
      });

      await Notifications?.setNotificationChannelAsync("downloads", {
        name: "Downloads",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FFB7B2",
      });
    }

    const granted = await checkAndRequestPermissions();
    if (!granted) return;

    if (!Platform.isTV && user && user.Policy?.IsAdministrator) {
      await registerBackgroundFetchAsyncSessions();
    }

    if (Device.isDevice) {
      Notifications?.getExpoPushTokenAsync({
        projectId: "e79219d1-797f-4fbe-9fa1-cfd360690a68",
      })
        .then((token: ExpoPushToken) => {
          if (token) setExpoPushToken(token);
        })
        .catch((reason: any) => {
          writeErrorLog("Failed to get Expo push token", reason);
        });
    }
  }, [user]);

  useEffect(() => {
    if (!Platform.isTV) {
      void registerNotifications();

      notificationListener.current =
        Notifications?.addNotificationReceivedListener(
          (notification: Notification) => {
            console.log(
              "Notification received:",
              notification.request.content.title,
            );
          },
        );

      responseListener.current =
        Notifications?.addNotificationResponseReceivedListener(
          (response: NotificationResponse) => {
            const { title, data } = response.notification.request.content;
            let url: any;
            const type = (data?.type ?? "").toString().toLowerCase();
            const itemId = data?.id;

            switch (type) {
              case "movie":
                url = `/(auth)/(tabs)/home/items/page?id=${itemId}`;
                break;
              case "episode":
                if (itemId) {
                  url = `/(auth)/(tabs)/home/items/page?id=${itemId}`;
                } else {
                  const seriesId = data?.seriesId;
                  const seasonIndex = data?.seasonIndex;
                  if (seasonIndex) {
                    url = `/(auth)/(tabs)/home/series/${seriesId}?seasonIndex=${seasonIndex}`;
                  } else {
                    url = `/(auth)/(tabs)/home/series/${seriesId}`;
                  }
                }
                break;
            }

            if (url) router.push(url);
          },
        );

      return () => {
        notificationListener.current?.remove();
        responseListener.current?.remove();
      };
    }
  }, [user]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: mmkvPersister,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            return (
              query.state.status === "success" && query.options.gcTime !== 0
            );
          },
        },
      }}
    >
      <JellyfinProvider>
        <InactivityProvider>
          <WifiSsidProvider>
            <ServerUrlProvider>
              <NetworkStatusProvider>
                <PlaySettingsProvider>
                  <LogProvider>
                    <WebSocketProvider>
                      <DownloadProvider>
                        <NativePlayerProvider>
                          <MusicPlayerProvider>
                            <GlobalModalProvider>
                              <BottomSheetModalProvider>
                                <IntroSheetProvider>
                                  {/* 使用马卡龙主题 */}
                                  <ThemeProvider value={MacaronTheme}>
                                    {/* 状态栏图标改为暗色，适应浅色背景 */}
                                    <SystemBars style='dark' hidden={false} />
                                    <Stack initialRouteName='(auth)/(tabs)'>
                                      <Stack.Screen
                                        name='(auth)/(tabs)'
                                        options={{
                                          headerShown: false,
                                          title: "",
                                          header: () => null,
                                        }}
                                      />
                                      <Stack.Screen
                                        name='(auth)/player'
                                        options={{
                                          headerShown: false,
                                          title: "",
                                          header: () => null,
                                        }}
                                      />
                                      <Stack.Screen
                                        name='(auth)/now-playing'
                                        options={{
                                          headerShown: false,
                                          presentation: "modal",
                                          gestureEnabled: true,
                                        }}
                                      />
                                      <Stack.Screen
                                        name='login'
                                        options={{
                                          headerShown: true,
                                          title: "",
                                          headerTransparent:
                                            Platform.OS === "ios",
                                        }}
                                      />
                                      <Stack.Screen name='+not-found' />
                                      <Stack.Screen
                                        name='(auth)/tv-option-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                      <Stack.Screen
                                        name='(auth)/tv-subtitle-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                      <Stack.Screen
                                        name='(auth)/tv-request-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                      <Stack.Screen
                                        name='(auth)/tv-season-select-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                      <Stack.Screen
                                        name='(auth)/tv-series-season-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                      <Stack.Screen
                                        name='tv-account-action-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                      <Stack.Screen
                                        name='tv-account-select-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                      <Stack.Screen
                                        name='(auth)/tv-user-switch-modal'
                                        options={{
                                          headerShown: false,
                                          presentation: "transparentModal",
                                          animation: "fade",
                                        }}
                                      />
                                    </Stack>
                                    {/* 软萌马卡龙风格 Toast 弹窗 */}
                                    <Toaster
                                      duration={4000}
                                      toastOptions={{
                                        style: {
                                          backgroundColor: "#FFFFFF",
                                          borderColor: "#FFDAC1",
                                          borderWidth: 2,
                                          borderRadius: 20,
                                        },
                                        titleStyle: {
                                          color: "#4A4A4A",
                                          fontWeight: "bold",
                                        },
                                      }}
                                      closeButton
                                    />
                                    {!Platform.isTV && <GlobalModal />}
                                    {!Platform.isTV && (
                                      <PendingAccountSaveModal />
                                    )}
                                  </ThemeProvider>
                                </IntroSheetProvider>
                              </BottomSheetModalProvider>
                            </GlobalModalProvider>
                          </MusicPlayerProvider>
                        </NativePlayerProvider>
                      </DownloadProvider>
                    </WebSocketProvider>
                  </LogProvider>
                </PlaySettingsProvider>
              </NetworkStatusProvider>
            </ServerUrlProvider>
          </WifiSsidProvider>
        </InactivityProvider>
      </JellyfinProvider>
    </PersistQueryClientProvider>
  );
}
