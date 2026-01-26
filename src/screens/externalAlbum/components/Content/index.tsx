import React, { useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { RefreshControl } from 'react-native';

import { ExternalAlbum, ExternalSong } from '@/types';
import ExternalAlbumHeader from '../Header';
import ExternalSongRow from '@/components/rows/ExternalSongRow';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  album: ExternalAlbum;
  onRefresh: () => void;
  isRefreshing: boolean;
};

const ESTIMATED_ROW_HEIGHT = 72;

const ExternalAlbumContent: React.FC<Props> = ({ album, onRefresh, isRefreshing }) => {
  const songs = album.songs ?? [];
  const { isDarkMode } = useTheme();

  const header = useMemo(() => {
    return <ExternalAlbumHeader album={album} />;
  }, [album]);

  const renderItem = ({ item }: { item: ExternalSong }) => {
    return <ExternalSongRow song={item} />;
  };

  return (
    <FlashList
      data={songs}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      estimatedItemSize={ESTIMATED_ROW_HEIGHT}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={isDarkMode ? '#fff' : '#000'}
        />
      }
    />
  );
};

export default ExternalAlbumContent;