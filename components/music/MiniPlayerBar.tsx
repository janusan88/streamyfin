import { Ionicons } from "@expo/vector-icons";
import { useAtom } from "jotai";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "@/components/common/GlassSurface";
import { Image } from "@/components/common/ServerImage";
import { Text } from "@/components/common/Text";
import useRouter from "@/hooks/useAppRouter";
import { apiAtom } from "@/providers/JellyfinProvider";
import { useMusicPlayer } from "@/providers/MusicPlayerProvider";

const HORIZONTAL_MARGIN = Platform.OS === "android" ? 12 : 20;
const BOTTOM_TAB_HEIGHT = Platform.OS === "android" ? 56 : 52;
const BAR_HEIGHT = Platform.OS === "android" ? 58 : 50;

// Gesture thresholds
const VELOCITY_THRESHOLD = 1000;

// Logarithmic slowdown - never stops, just gets progressively slower
const rubberBand = (distance: number, scale: number = 8): number => {
  "worklet";
  const absDistance = Math.abs(distance);
  const sign = distance < 0 ? -1 : 1;
  return sign * scale * Math.log(1 + absDistance / scale);
};

export const MiniPlayerBar: React.FC = () => {
  const [api] = useAtom(apiAtom);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    progress,
    duration,
    togglePlayPause,
    next,
    stop,
  } = useMusicPlayer();

  // Gesture state
  const translateY = useSharedValue(0);

  const imageUrl = useMemo(() => {
    if (!api || !currentTrack) return null;
    const albumId = currentTrack.AlbumId || currentTrack.ParentId;
    if (albumId) {
      return `${api.basePath}/Items/${albumId}/Images/Primary?maxHeight=100&maxWidth=100`;
    }
    return `${api.basePath}/Items/${currentTrack.Id}/Images/Primary?maxHeight=100&maxWidth=100`;
  }, [api, currentTrack]);

  const handlePress = useCallback(() => {
    router.push("/(auth)/now-playing");
  }, [router]);

  const handlePlayPause = useCallback(
    (e: any) => {
      e.stopPropagation();
      togglePlayPause();
    },
    [togglePlayPause],
  );

  const handleNext = useCallback(
    (e: any) => {
      e.stopPropagation();
      next();
    },
    [next],
  );

  const handleDismiss = useCallback(() => {
    stop();
  }, [stop]);

  // Pan gesture for swipe up (open modal) and swipe down (dismiss)
  const panGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .onUpdate((event) => {
      translateY.value = rubberBand(event.translationY, 6);
    })
    .onEnd((event) => {
      const velocity = event.velocityY;
      const currentPosition = translateY.value;

      if (currentPosition < -16 || velocity < -VELOCITY_THRESHOLD) {
        translateY.value = withTiming(0, {
          duration: 600,
          easing: Easing.out(Easing.cubic),
        });
        runOnJS(handlePress)();
        return;
      }
      if (currentPosition > 16 || velocity > VELOCITY_THRESHOLD) {
        runOnJS(handleDismiss)();
        return;
      }

      translateY.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBarStyle = useAnimatedStyle(() => ({
    height: interpolate(
      translateY.value,
      [-50, 0, 50],
      [BAR_HEIGHT + 12, BAR_HEIGHT, BAR_HEIGHT],
      Extrapolation.EXTEND,
    ),
    opacity: interpolate(
      translateY.value,
      [0, 30],
      [1, 0.6],
      Extrapolation.CLAMP,
    ),
  }));

  if (!currentTrack) return null;

  const content = (
    <>
      {/* Tappable area: Album art + Track info */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={styles.tappableArea}
      >
        {/* Album art */}
        <View style={styles.albumArt}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.albumImage}
              contentFit='cover'
              cachePolicy='memory-disk'
            />
          ) : (
            <View style={styles.albumPlaceholder}>
              <Ionicons name='musical-note' size={18} color='#FFB7B2' />
            </View>
          )}
        </View>

        {/* Track info */}
        <View style={styles.trackInfo}>
          <Text numberOfLines={1} style={styles.trackTitle}>
            {currentTrack.Name}
          </Text>
          <Text numberOfLines={1} style={styles.artistName}>
            {currentTrack.Artists?.join(", ") || currentTrack.AlbumArtist}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Controls */}
      <View style={styles.controls}>
        {isLoading ? (
          <ActivityIndicator size='small' color='#FFB7B2' style={styles.loader} />
        ) : (
          <>
            <TouchableOpacity
              onPress={handlePlayPause}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.controlButton}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={22}
                color='#4A4A4A'
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNext}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.controlButton}
            >
              <Ionicons name='play-forward' size={20} color='#4A4A4A' />
            </TouchableOpacity>
          </>
        )}
      </View>
    </>
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          {
            bottom:
              BOTTOM_TAB_HEIGHT +
              insets.bottom +
              (Platform.OS === "android" ? 24 : 8),
          },
          animatedContainerStyle,
        ]}
      >
        <Animated.View style={[styles.touchable, animatedBarStyle]}>
          {Platform.OS === "ios" && !Platform.isTV ? (
            <GlassSurface style={styles.blurContainer}>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingRight: 12,
                  paddingLeft: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.85)",
                }}
              >
                {content}
              </View>
            </GlassSurface>
          ) : (
            <View style={styles.androidContainer}>{content}</View>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: HORIZONTAL_MARGIN,
    right: HORIZONTAL_MARGIN,
    shadowColor: "#FFB7B2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  touchable: {
    borderRadius: 25,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#FFDAC1",
  },
  blurContainer: {
    flex: 1,
  },
  androidContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
  },
  tappableArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  albumArt: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFF1C5",
  },
  albumImage: {
    width: "100%",
    height: "100%",
  },
  albumPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1C5",
  },
  trackInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    justifyContent: "center",
  },
  trackTitle: {
    color: "#4A4A4A",
    fontSize: 13,
    fontWeight: "700",
  },
  artistName: {
    color: "#8A7A7A",
    fontSize: 11,
    marginTop: 1,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
  },
  controlButton: {
    padding: 6,
    marginLeft: 4,
  },
  loader: {
    marginHorizontal: 12,
  },
});
