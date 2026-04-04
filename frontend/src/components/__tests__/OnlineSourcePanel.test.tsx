import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { OnlineSourcePanel } from '../OnlineSourcePanel';

describe('OnlineSourcePanel', () => {
  test('renders results and exposes play / favorite / download actions', () => {
    render(
      <OnlineSourcePanel
        activeTrackKey={null}
        favoriteCount={1}
        isPlaying={false}
        onDownload={vi.fn()}
        onPlay={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleFavoritesOnly={vi.fn()}
        results={[
          {
            is_online: true,
            online_id: 'song-1',
            online_source_id: 'demo',
            online_stream_url: 'https://demo/song.mp3',
            path: '',
            subtitle: 'Artist',
            title: 'Net Song',
          },
        ]}
        searchQuery="net song"
        showFavoritesOnly={false}
      />,
    );

    expect(screen.getByText('Net Song')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /收藏 Net Song/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /下载 Net Song/i })).toBeInTheDocument();
  });

  test('calls handlers for play, favorite, download and favorite filter', () => {
    const onPlay = vi.fn();
    const onToggleFavorite = vi.fn();
    const onDownload = vi.fn();
    const onToggleFavoritesOnly = vi.fn();

    render(
      <OnlineSourcePanel
        activeTrackKey={null}
        favoriteCount={1}
        isPlaying={false}
        onDownload={onDownload}
        onPlay={onPlay}
        onToggleFavorite={onToggleFavorite}
        onToggleFavoritesOnly={onToggleFavoritesOnly}
        results={[
          {
            is_online: true,
            online_id: 'song-1',
            online_source_id: 'demo',
            online_stream_url: 'https://demo/song.mp3',
            path: '',
            subtitle: 'Artist',
            title: 'Net Song',
          },
        ]}
        searchQuery="net song"
        showFavoritesOnly={false}
      />,
    );

    const row = screen.getByText('Net Song').closest('.track-row');
    if (!row) {
      throw new Error('track row not found');
    }

    fireEvent.mouseEnter(row);
    fireEvent.click(screen.getByRole('button', { name: /播放 Net Song/i }));
    fireEvent.click(screen.getByRole('button', { name: /收藏 Net Song/i }));
    fireEvent.click(screen.getByRole('button', { name: /下载 Net Song/i }));
    fireEvent.click(screen.getByRole('button', { name: /仅看收藏/i }));

    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Net Song' }),
      0,
      [expect.objectContaining({ title: 'Net Song' })],
    );
    expect(onToggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ title: 'Net Song' }));
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ title: 'Net Song' }));
    expect(onToggleFavoritesOnly).toHaveBeenCalledOnce();
  });
});
