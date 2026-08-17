import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import type React from "react";
import { View } from "react-native";
import { Text } from "./common/Text";

type ItemCardProps = {
  item: BaseItemDto;
};

export const ItemCardText: React.FC<ItemCardProps> = ({ item }) => {
  return (
    <View className='mt-2.5 flex flex-col px-0.5'>
      {item.Type === "Episode" ? (
        <>
          <Text 
            numberOfLines={1} 
            ellipsizeMode='tail' 
            style={{ color: "#4A4A4A" }} 
            className='text-sm font-semibold tracking-wide'
          >
            {item.Name}
          </Text>
          <Text 
            numberOfLines={1} 
            style={{ color: "#8A7A7A" }} 
            className='mt-0.5 text-xs font-medium'
          >
            {`S${item.ParentIndexNumber?.toString()}:E${item.IndexNumber?.toString()}`}
            {" - "}
            {item.SeriesName}
          </Text>
        </>
      ) : (
        <>
          <Text 
            numberOfLines={1} 
            ellipsizeMode='tail' 
            style={{ color: "#4A4A4A" }} 
            className='text-sm font-semibold tracking-wide'
          >
            {item.Name}
          </Text>
          <Text 
            style={{ color: "#8A7A7A" }} 
            className='mt-0.5 text-xs font-medium'
          >
            {item.ProductionYear}
          </Text>
        </>
      )}
    </View>
  );
};
