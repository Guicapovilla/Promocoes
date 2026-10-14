export type LatestVideo = { id: string; title: string; thumb: string; publishedAt: string; views: number | null; duration: string | null; url: string };

const parseDuration = (iso: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!m) return null;
  const [h, min, s] = [m[1], m[2], m[3]].map((v) => Number(v ?? 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(min)}:${pad(s)}` : `${pad(min)}:${pad(s)}`;
};

/**
 * Último vídeo do canal via YouTube Data API v3, com cache de 1h.
 * Usa a playlist de uploads (1 unidade de cota) em vez de search.list (100 unidades).
 */
export async function getLatestVideo(): Promise<LatestVideo | null> {
  const key = process.env.YOUTUBE_API_KEY;
  const channel = process.env.YOUTUBE_CHANNEL_ID;
  if (!key || !channel?.startsWith("UC")) return null;
  const opts = { next: { revalidate: 3600 } };
  try {
    const list = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=1&playlistId=UU${channel.slice(2)}&key=${key}`,
      opts,
    ).then((r) => (r.ok ? r.json() : null));
    const item = list?.items?.[0]?.snippet;
    const id = item?.resourceId?.videoId;
    if (!id) return null;
    const detail = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${id}&key=${key}`, opts)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const d = detail?.items?.[0];
    return {
      id,
      title: item.title,
      thumb: item.thumbnails?.maxres?.url ?? item.thumbnails?.high?.url ?? item.thumbnails?.default?.url,
      publishedAt: item.publishedAt,
      views: d?.statistics?.viewCount ? Number(d.statistics.viewCount) : null,
      duration: d?.contentDetails?.duration ? parseDuration(d.contentDetails.duration) : null,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  } catch {
    return null;
  }
}

export const viewsLabel = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)} mil views` : `${n} views`);
