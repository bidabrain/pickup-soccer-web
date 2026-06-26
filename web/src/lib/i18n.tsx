import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'zh' | 'en' | 'ko'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
]

const LOCALES: Record<Lang, string> = { zh: 'zh-CN', en: 'en-US', ko: 'ko-KR' }

type Dict = Record<string, string>

const zh: Dict = {
  'nav.guide': '使用说明', 'nav.download': '下载客户端',
  'common.close': '关闭', 'common.back': '返回', 'common.share': '分享', 'common.manage': '管理', 'common.loading': '加载中…',
  'home.current': '当前预约场次', 'home.empty': '还没有预约，点右下角 + 新建一个', 'home.newMatch': '新建预约',
  'card.ended': '已结束', 'card.shortfall': '还差 {n} 人', 'card.fullWaiting': '已满 +{n} 候补', 'card.full': '已满',
  'card.people': '{c} / {m} 人', 'card.perPerson': '₩{fee} / 人',
  'share.copied': '分享链接已复制：\n{url}', 'share.manual': '复制此分享链接：',
  'create.title': '新建预约', 'create.tz': '时区（默认韩国 KST）', 'create.date': '日期 · 仅限今天起 7 天内', 'create.today': '今天',
  'create.time': '时间', 'create.venue': '场地', 'create.venuePlaceholder': '如 滨江体育公园 3 号场',
  'create.fee': '每人费用（韩元 ₩）', 'create.max': '上场人数', 'create.note': '备注 · 选填',
  'create.managePin': '设置管理 PIN · 用于日后修改本场', 'create.errVenue': '请填写场地', 'create.errManagePin': '请设置 6 位数字管理 PIN',
  'create.submit': '创建预约', 'create.submitting': '创建中…',
  'detail.title': '场次详情', 'detail.endedReadonly': '该场已结束，仅可查看', 'detail.captain': '队长',
  'detail.registered': '已报名 {n} 人', 'detail.onField': '上场 {n} 人', 'detail.paid': '已付', 'detail.captainBadge': '队长', 'detail.waiting': '候补名单 (Waiting List) · {n} 人',
  'detail.venueLabel': '场地', 'detail.feeLabel': '活动费', 'detail.onFieldLabel': '上场人数', 'detail.players': '{n} 人',
  'detail.sumShort': '已报名 {n} 人 · 还差 {s} 人', 'detail.sumWaiting': '已报名 {n} 人 · 候补名单还有 {w} 人', 'detail.sumFull': '已报名 {n} 人 · 人数刚好',
  'detail.register': '报名参加', 'detail.draw': '随机抽队长', 'detail.edit': '编辑本场', 'detail.delete': '删除本场',
  'detail.hint': '报名后可点自己的名字修改/删除 · 编辑与删除本场需管理 PIN',
  'reg.title': '报名参加', 'reg.name': '你的名字', 'reg.pin': '设置 PIN · 日后改/删自己的报名需要它', 'reg.submit': '确认报名', 'reg.errName': '请输入名字', 'reg.errPin': '请设置 6 位数字 PIN',
  'manage.title': '管理报名 · {name}', 'manage.paid': '已付活动费', 'manage.pin': '输入你报名时设置的 PIN', 'manage.save': '保存修改', 'manage.delete': '删除报名', 'manage.errName': '请输入名字', 'manage.errPin': '请输入你的 PIN', 'manage.confirm': '确认删除这条报名？',
  'manage.payTitle': '标记付款 · {name}', 'manage.payOnly': '该场已结束，仅可修改「已付活动费」', 'detail.markPaid': '标记付款',
  'edit.title': '编辑本场（日期不可改）', 'edit.time': '时间', 'edit.venue': '场地', 'edit.fee': '费用', 'edit.max': '人数', 'edit.note': '备注', 'edit.pin': '管理 PIN', 'edit.save': '保存', 'edit.errPin': '请输入管理 PIN',
  'del.title': '删除本场', 'del.warn': '将永久删除本场，并移除 {n} 名报名球员。此操作不可恢复。', 'del.pin': '管理 PIN', 'del.confirm': '确认删除', 'del.errPin': '请输入管理 PIN',
  'draw.title': '随机抽 2 名队长', 'draw.desc': '从「确认上场」名单中随机抽取 2 人作为队长。可重复抽，覆盖上次结果。', 'draw.pin': '管理 PIN', 'draw.submit': '抽取',
  'pin.placeholder': '6 位数字',
  'err.pinInvalid': 'PIN 错误', 'err.pinDuplicate': '该 PIN 与本场其他人重复，请换一个', 'err.rateLimited': '尝试过于频繁，请约 10 分钟后再试', 'err.matchLocked': '该场已开赛，不可修改', 'err.notFound': '未找到（可能已被清除）', 'err.validation': '输入有误', 'err.failed': '操作失败', 'err.network': '网络错误，请重试',
}

const en: Dict = {
  'nav.guide': 'Guide', 'nav.download': 'Get Android App',
  'common.close': 'Close', 'common.back': 'Back', 'common.share': 'Share', 'common.manage': 'Manage', 'common.loading': 'Loading…',
  'home.current': 'Upcoming matches', 'home.empty': 'No matches yet — tap + to create one', 'home.newMatch': 'New match',
  'card.ended': 'Ended', 'card.shortfall': '{n} more needed', 'card.fullWaiting': 'Full · +{n} waiting', 'card.full': 'Full',
  'card.people': '{c} / {m} players', 'card.perPerson': '₩{fee} / person',
  'share.copied': 'Share link copied:\n{url}', 'share.manual': 'Copy this share link:',
  'create.title': 'New match', 'create.tz': 'Timezone (default KST)', 'create.date': 'Date · within 7 days from today', 'create.today': 'Today',
  'create.time': 'Time', 'create.venue': 'Venue', 'create.venuePlaceholder': 'e.g. Riverside Field #3',
  'create.fee': 'Fee per person (KRW ₩)', 'create.max': 'Players on field', 'create.note': 'Note · optional',
  'create.managePin': 'Set a manager PIN · needed to edit this match later', 'create.errVenue': 'Please enter a venue', 'create.errManagePin': 'Set a 6-digit manager PIN',
  'create.submit': 'Create match', 'create.submitting': 'Creating…',
  'detail.title': 'Match details', 'detail.endedReadonly': 'This match has ended — view only', 'detail.captain': 'Captains',
  'detail.registered': '{n} registered', 'detail.onField': '{n} on field', 'detail.paid': 'Paid', 'detail.captainBadge': 'Captain', 'detail.waiting': 'Waiting list · {n}',
  'detail.venueLabel': 'Venue', 'detail.feeLabel': 'Fee', 'detail.onFieldLabel': 'On field', 'detail.players': '{n} players',
  'detail.sumShort': '{n} registered · {s} more needed', 'detail.sumWaiting': '{n} on field · {w} on waiting list', 'detail.sumFull': '{n} registered · full',
  'detail.register': 'Sign up', 'detail.draw': 'Draw captains', 'detail.edit': 'Edit match', 'detail.delete': 'Delete match',
  'detail.hint': 'After signing up, tap your name to edit/remove · editing or deleting the match needs the manager PIN',
  'reg.title': 'Sign up', 'reg.name': 'Your name', 'reg.pin': 'Set a PIN · needed to edit/remove your sign-up later', 'reg.submit': 'Confirm sign-up', 'reg.errName': 'Please enter your name', 'reg.errPin': 'Set a 6-digit PIN',
  'manage.title': 'Manage sign-up · {name}', 'manage.paid': 'Activity fee paid', 'manage.pin': 'Enter the PIN you set when signing up', 'manage.save': 'Save changes', 'manage.delete': 'Remove sign-up', 'manage.errName': 'Please enter your name', 'manage.errPin': 'Please enter your PIN', 'manage.confirm': 'Remove this sign-up?',
  'manage.payTitle': 'Mark payment · {name}', 'manage.payOnly': 'This match has ended — only the paid status can be changed', 'detail.markPaid': 'Mark paid',
  'edit.title': 'Edit match (date locked)', 'edit.time': 'Time', 'edit.venue': 'Venue', 'edit.fee': 'Fee', 'edit.max': 'Players', 'edit.note': 'Note', 'edit.pin': 'Manager PIN', 'edit.save': 'Save', 'edit.errPin': 'Please enter the manager PIN',
  'del.title': 'Delete match', 'del.warn': 'This permanently deletes the match and removes {n} registered players. This cannot be undone.', 'del.pin': 'Manager PIN', 'del.confirm': 'Confirm delete', 'del.errPin': 'Please enter the manager PIN',
  'draw.title': 'Draw 2 captains', 'draw.desc': 'Randomly pick 2 captains from the confirmed list. You can redraw, which overwrites the previous result.', 'draw.pin': 'Manager PIN', 'draw.submit': 'Draw',
  'pin.placeholder': '6 digits',
  'err.pinInvalid': 'Wrong PIN', 'err.pinDuplicate': 'This PIN is already used in this match — pick another', 'err.rateLimited': 'Too many attempts — try again in ~10 minutes', 'err.matchLocked': 'This match has started and cannot be changed', 'err.notFound': 'Not found (may have been cleared)', 'err.validation': 'Invalid input', 'err.failed': 'Operation failed', 'err.network': 'Network error, please retry',
}

const ko: Dict = {
  'nav.guide': '사용 설명', 'nav.download': '앱 다운로드',
  'common.close': '닫기', 'common.back': '뒤로', 'common.share': '공유', 'common.manage': '관리', 'common.loading': '불러오는 중…',
  'home.current': '예정된 경기', 'home.empty': '아직 예약이 없습니다 — + 를 눌러 만들어 보세요', 'home.newMatch': '새 예약',
  'card.ended': '종료됨', 'card.shortfall': '{n}명 더 필요', 'card.fullWaiting': '마감 · 대기 {n}', 'card.full': '마감',
  'card.people': '{c} / {m}명', 'card.perPerson': '₩{fee} / 인',
  'share.copied': '공유 링크가 복사되었습니다:\n{url}', 'share.manual': '이 공유 링크를 복사하세요:',
  'create.title': '새 예약', 'create.tz': '시간대 (기본 KST)', 'create.date': '날짜 · 오늘부터 7일 이내', 'create.today': '오늘',
  'create.time': '시간', 'create.venue': '장소', 'create.venuePlaceholder': '예: 강변 운동장 3번',
  'create.fee': '1인 참가비 (원 ₩)', 'create.max': '출전 인원', 'create.note': '메모 · 선택',
  'create.managePin': '관리 PIN 설정 · 이후 이 경기를 수정할 때 필요', 'create.errVenue': '장소를 입력하세요', 'create.errManagePin': '6자리 관리 PIN을 설정하세요',
  'create.submit': '예약 만들기', 'create.submitting': '생성 중…',
  'detail.title': '경기 상세', 'detail.endedReadonly': '종료된 경기 — 보기 전용', 'detail.captain': '주장',
  'detail.registered': '신청 {n}명', 'detail.onField': '출전 {n}명', 'detail.paid': '납부', 'detail.captainBadge': '주장', 'detail.waiting': '대기 명단 · {n}명',
  'detail.venueLabel': '장소', 'detail.feeLabel': '참가비', 'detail.onFieldLabel': '출전 인원', 'detail.players': '{n}명',
  'detail.sumShort': '신청 {n}명 · {s}명 더 필요', 'detail.sumWaiting': '출전 {n}명 · 대기 {w}명', 'detail.sumFull': '신청 {n}명 · 인원 마감',
  'detail.register': '신청하기', 'detail.draw': '주장 뽑기', 'detail.edit': '경기 수정', 'detail.delete': '경기 삭제',
  'detail.hint': '신청 후 본인 이름을 눌러 수정/삭제 · 경기 수정·삭제는 관리 PIN 필요',
  'reg.title': '신청하기', 'reg.name': '이름', 'reg.pin': 'PIN 설정 · 이후 본인 신청 수정/삭제에 필요', 'reg.submit': '신청 확정', 'reg.errName': '이름을 입력하세요', 'reg.errPin': '6자리 PIN을 설정하세요',
  'manage.title': '신청 관리 · {name}', 'manage.paid': '참가비 납부', 'manage.pin': '신청 시 설정한 PIN 입력', 'manage.save': '변경 저장', 'manage.delete': '신청 삭제', 'manage.errName': '이름을 입력하세요', 'manage.errPin': 'PIN을 입력하세요', 'manage.confirm': '이 신청을 삭제할까요?',
  'manage.payTitle': '납부 표시 · {name}', 'manage.payOnly': '종료된 경기 — 「참가비 납부」만 변경 가능', 'detail.markPaid': '납부 표시',
  'edit.title': '경기 수정 (날짜 변경 불가)', 'edit.time': '시간', 'edit.venue': '장소', 'edit.fee': '참가비', 'edit.max': '인원', 'edit.note': '메모', 'edit.pin': '관리 PIN', 'edit.save': '저장', 'edit.errPin': '관리 PIN을 입력하세요',
  'del.title': '경기 삭제', 'del.warn': '경기를 영구 삭제하고 신청자 {n}명을 제거합니다. 되돌릴 수 없습니다.', 'del.pin': '관리 PIN', 'del.confirm': '삭제 확인', 'del.errPin': '관리 PIN을 입력하세요',
  'draw.title': '주장 2명 뽑기', 'draw.desc': '확정 명단에서 무작위로 2명을 주장으로 뽑습니다. 다시 뽑으면 이전 결과를 덮어씁니다.', 'draw.pin': '관리 PIN', 'draw.submit': '뽑기',
  'pin.placeholder': '6자리 숫자',
  'err.pinInvalid': 'PIN 오류', 'err.pinDuplicate': '이 PIN은 이미 사용 중입니다 — 다른 PIN을 사용하세요', 'err.rateLimited': '시도가 너무 많습니다 — 약 10분 후 다시 시도하세요', 'err.matchLocked': '이미 시작된 경기로 변경할 수 없습니다', 'err.notFound': '찾을 수 없음 (삭제되었을 수 있음)', 'err.validation': '입력 오류', 'err.failed': '작업 실패', 'err.network': '네트워크 오류, 다시 시도하세요',
}

const DICTS: Record<Lang, Dict> = { zh, en, ko }

function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? zh[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
  locale: string
}

const I18nCtx = createContext<I18nValue>({ lang: 'zh', setLang: () => {}, t: (k) => k, locale: 'zh-CN' })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang')
    return saved === 'en' || saved === 'ko' || saved === 'zh' ? saved : 'zh'
  })
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = (l: Lang) => {
    localStorage.setItem('lang', l)
    setLangState(l)
  }
  const value: I18nValue = { lang, setLang, t: (k, p) => translate(lang, k, p), locale: LOCALES[lang] }
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  return useContext(I18nCtx)
}
