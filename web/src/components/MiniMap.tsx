import { useI18n } from '../lib/i18n'

// 嵌入式小地图：用 OpenStreetMap 的 embed iframe 显示一个带标记的小地图。
// 完全免费、无需 API key。仅在有经纬度（即用户从下拉选过地址）时渲染。

interface Props {
  lat: number
  lon: number
  className?: string
}

export default function MiniMap({ lat, lon, className }: Props) {
  const { t } = useI18n()
  const dx = 0.006
  const dy = 0.003
  const bbox = `${lon - dx},${lat - dy},${lon + dx},${lat + dy}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`
  return (
    <div className={className}>
      <iframe
        title="map"
        src={src}
        loading="lazy"
        className="h-44 w-full rounded-lg border border-gray-200"
      />
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs text-emerald-600 hover:underline"
      >
        {t('venue.viewLarger')}
      </a>
    </div>
  )
}
