import type React from "react";
import {
  type PropsWithChildren,
  type ReactNode,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useHaptic } from "@/hooks/useHaptic";
import { scaleSize } from "@/utils/scaleSize";
import { Loader } from "./Loader";

const getColorClasses = (
  color: "purple" | "red" | "black" | "transparent" | "white",
  variant: "solid" | "border",
  focused: boolean,
): string => {
  if (variant === "border") {
    switch (color) {
      case "purple":
        return focused
          ? "bg-transparent border-2 border-[#FFB7B2]"
          : "bg-transparent border-2 border-[#FFDAC1]";
      case "red":
        return focused
          ? "bg-transparent border-2 border-[#FF9AA2]"
          : "bg-transparent border-2 border-[#FFB7B2]";
      case "black":
        return focused
          ? "bg-transparent border-2 border-neutral-700"
          : "bg-transparent border-2 border-neutral-800";
      case "white":
        return focused
          ? "bg-transparent border-2 border-gray-200"
          : "bg-transparent border-2 border-white";
      case "transparent":
        return focused
          ? "bg-transparent border-2 border-gray-300"
          : "bg-transparent border-2 border-gray-400";
      default:
        return "";
    }
  } else {
    switch (color) {
      case "purple":
        return focused
          ? "bg-[#FFB7B2] border-2 border-white"
          : "bg-[#FFB7B2] border border-[#FFDAC1]";
      case "red":
        return "bg-[#FF9AA2]";
      case "black":
        return "bg-[#4A4A4A]";
      case "white":
        return focused
          ? "bg-[#FFF1C5] border-2 border-[#FFDAC1]"
          : "bg-white border border-[#FFDAC1]";
      case "transparent":
        return "bg-transparent";
      default:
        return "";
    }
  }
};

export interface ButtonProps
  extends React.ComponentProps<typeof TouchableOpacity> {
  onPress?: () => void;
  className?: string;
  textClassName?: string;
  disabled?: boolean;
  children?: string | ReactNode;
  loading?: boolean;
  color?: "purple" | "red" | "black" | "transparent" | "white";
  variant?: "solid" | "border";
  iconRight?: ReactNode;
  iconLeft?: ReactNode;
  justify?: "center" | "between";
}

export const Button: React.FC<PropsWithChildren<ButtonProps>> = ({
  onPress,
  className = "",
  textClassName = "",
  disabled = false,
  loading = false,
  color = "purple",
  variant = "solid",
  iconRight,
  iconLeft,
  children,
  justify = "center",
  ...props
}) => {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (v: number) =>
    Animated.timing(scale, {
      toValue: v,
      duration: 130,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const colorClasses = getColorClasses(color, variant, focused);

  const lightHapticFeedback = useHaptic("light");

  const textColorClass =
    color === "white" && variant === "solid"
      ? "text-[#4A4A4A]"
      : color === "purple" && variant === "solid"
      ? "text-white"
      : "text-[#4A4A4A]";

  return Platform.isTV ? (
    <Pressable
      className='w-full'
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        animateTo(1.03);
      }}
      onBlur={() => {
        setFocused(false);
        animateTo(1);
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          shadowColor: "#FFB7B2",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: focused ? 0.4 : 0,
          shadowRadius: focused ? scaleSize(12) : 0,
          elevation: focused ? 12 : 0,
        }}
      >
        <View
          style={{
            borderRadius: scaleSize(24),
            paddingVertical: scaleSize(14),
            alignItems: "center",
            justifyContent: "center",
          }}
          className={`${colorClasses} ${className}`}
        >
          <Text
            style={{
              fontSize: scaleSize(20),
              fontWeight: "bold",
            }}
            className={textColorClass}
          >
            {children}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  ) : (
    <TouchableOpacity
      className={`
        px-5 py-3 rounded-full items-center justify-center
        ${(loading || disabled) && "opacity-50"}
        ${colorClasses}
        ${className}
      `}
      style={{
        shadowColor: "#FFB7B2",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
      }}
      onPress={() => {
        if (!loading && !disabled && onPress) {
          onPress();
          lightHapticFeedback();
        }
      }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <View className='p-0.5'>
          <Loader />
        </View>
      ) : (
        <View
          className={`
            flex flex-row items-center w-full
            ${justify === "between" ? "justify-between" : "justify-center"}`}
        >
          {iconLeft ? iconLeft : <View className='w-2' />}
          <Text
            className={`
              ${textColorClass} font-bold text-base tracking-wide
              ${disabled ? "text-gray-300" : ""}
              ${textClassName}
              ${iconRight ? "mr-2" : ""}
              ${iconLeft ? "ml-2" : ""}
            `}
          >
            {children}
          </Text>
          {iconRight ? iconRight : <View className='w-2' />}
        </View>
      )}
    </TouchableOpacity>
  );
};
