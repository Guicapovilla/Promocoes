import { getLatestVideo, viewsLabel } from "@/lib/youtube";

export async function VideoBanner() {
  const v = await getLatestVideo();
  if (!v) return null;
  const days = Math.floor((Date.now() - Date.parse(v.publishedAt)) / 86_400_000);
  const when = days <= 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
  return (
    <div className="banner">
      <div className="banner-glow" />
      <img src={v.thumb || "/assets/thumb-switch-desbloqueado.png"} alt="" />
      <div className="banner-body">
        <span className="eyebrow"><i />Novo vídeo · {when}</span>
        <h2>{v.title.toUpperCase()}</h2>
        <span style={{ font: "var(--text-body-sm)", color: "#ada6b8" }}>
          {[v.views != null && viewsLabel(v.views), v.duration].filter(Boolean).join(" · ")}
        </span>
      </div>
      <a className="btn btn-lg btn-secondary" style={{ position: "relative" }} href={v.url} target="_blank" rel="noreferrer">
        Assistir agora
      </a>
    </div>
  );
}
