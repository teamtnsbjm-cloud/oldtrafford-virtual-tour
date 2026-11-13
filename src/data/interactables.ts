import { LOCKERS, SCOREBOARDS } from '../world/layout'

export interface Interactable {
  id: string
  title: string
  /** Paragraphs shown in the info panel. */
  body: string[]
  position: [number, number, number]
  /** Max distance (m) at which the prompt appears. */
  range: number
  /** How precisely the visitor must look at it (cosine of angle). */
  minDot?: number
}

const you = LOCKERS[7]
const shirt = LOCKERS[2]

export const INTERACTABLES: Interactable[] = [
  {
    id: 'plaza-tour-sign',
    title: '스타디움 투어 안내판',
    body: [
      'Theatre of Dreams Virtual Tour에 오신 것을 환영합니다.',
      '추천 동선: 외부 광장 → 로비 → 라커룸 → 선수 터널 → 경기장. 메가스토어는 광장 동쪽 건물입니다.',
      '이 공간은 팬이 직접 만든 비공식 콘셉트 재현이며, 구단 또는 경기장 운영사와 관련이 없습니다.',
    ],
    position: [-9, 2, 99],
    range: 7,
  },
  {
    id: 'plaza-sculpture',
    title: '팬 트리뷰트 조형물',
    body: [
      '전 세계에서 직접 오지 못하는 팬들을 위한 상징적 조형물입니다.',
      '실제 경기장 앞 동상들을 재현한 것이 아니라 이 프로젝트를 위해 만든 추상 조형물입니다.',
    ],
    position: [-26, 2, 104],
    range: 7,
  },
  {
    id: 'facade',
    title: '경기장 외관',
    body: [
      '유리 커튼월과 지붕 위 트러스 구조로 웅장한 정면을 표현했습니다.',
      '실제 경기장의 정확한 설계도를 바탕으로 한 것이 아니라 사진에서 받은 인상을 바탕으로 절차적으로 모델링한 팬 콘셉트입니다.',
      '가운데 출입문으로 들어가면 내부 로비로 이어집니다.',
    ],
    position: [0, 3, 89.5],
    range: 14,
    minDot: 0.9,
  },
  {
    id: 'lobby-board',
    title: '투어 안내',
    body: [
      '투어 경로: 로비 → 라커룸 복도(북서쪽 문) → 선수 라커룸 → 선수 터널 → 피치.',
      '빠른 이동: 숫자 키 1~7 또는 오른쪽 메뉴를 사용하세요.',
    ],
    position: [-14.8, 2.5, 80],
    range: 8,
  },
  {
    id: 'lobby-history',
    title: '히스토리 월',
    body: [
      '올드 트래포드는 1910년에 문을 연 잉글랜드의 대표적인 축구 경기장입니다.',
      '“꿈의 극장(Theatre of Dreams)”이라는 별칭으로 널리 알려져 있습니다.',
      '향후 업데이트에서 박물관 공간과 함께 연표 콘텐츠를 확장할 예정입니다.',
    ],
    position: [14.8, 2.5, 84],
    range: 8,
  },
  {
    id: 'lobby-museum',
    title: '박물관 · 트로피룸 (준비 중)',
    body: ['이 문 너머의 박물관과 트로피룸은 다음 단계(Phase 2)에서 구현될 예정입니다. 아직 입장할 수 없습니다.'],
    position: [14.8, 1.6, 76],
    range: 6,
  },
  {
    id: 'locker-tactics',
    title: '전술 보드',
    body: [
      '경기 전 감독이 포메이션과 세트피스를 설명하는 보드입니다.',
      '그려진 4-2-3-1 포메이션은 예시용 데모입니다.',
    ],
    position: [-6.3, 1.5, 62.2],
    range: 5,
  },
  {
    id: 'locker-you',
    title: '당신의 라커 · #26',
    body: [
      '투어 방문자를 위한 라커입니다. 등 번호 26은 이 프로젝트가 시작된 2026년을 뜻합니다.',
      '유니폼은 구단 공식 디자인이 아닌, 로고 없는 팬 콘셉트 셔츠입니다.',
    ],
    position: [you.x, 1.4, you.z],
    range: 3.5,
  },
  {
    id: 'locker-shirt',
    title: '선수 라커',
    body: [
      '각 라커에는 등 번호 셔츠, 개인 수납공간, 벤치 쿠션이 있습니다.',
      '실존 선수의 이름은 사용하지 않고 번호만 표시했습니다.',
    ],
    position: [shirt.x, 1.4, shirt.z],
    range: 3.5,
  },
  {
    id: 'locker-emblem',
    title: '바닥 엠블럼',
    body: ['라커룸 중앙 바닥 엠블럼은 공식 로고가 아닌 이 투어 전용 팬 콘셉트 엠블럼입니다.'],
    position: [-16, 0, 58],
    range: 7,
    minDot: 0.85,
  },
  {
    id: 'tunnel-sign',
    title: '선수 입장 터널',
    body: [
      '선수들이 라커룸에서 피치로 걸어 나가는 통로입니다.',
      '앞으로 걸어가면 조명이 점점 밝아지고, 터널 끝에서 경기장 전체가 펼쳐집니다.',
    ],
    position: [0, 2.6, 43],
    range: 12,
  },
  {
    id: 'pitch-centre',
    title: '센터 서클',
    body: [
      '피치 크기는 국제 권장 규격(105m × 68m)을 참고했습니다.',
      '잔디의 줄무늬는 실제 경기장처럼 잔디를 깎는 방향을 번갈아 표현한 것입니다.',
    ],
    position: [0, 0, 0],
    range: 16,
    minDot: 0.85,
  },
  ...SCOREBOARDS.map((s, i) => ({
    id: `scoreboard-${i}`,
    title: '전광판 (DEMO)',
    body: [
      '현재 전광판에 표시되는 점수는 데모 데이터입니다. 실제 경기 결과가 아닙니다.',
      '전광판은 독립 컴포넌트(Scoreboard)로 만들어져 있어, 이후 축구 데이터 API를 연결하면 실시간 스코어를 표시할 수 있습니다.',
    ],
    position: s.position,
    range: 160,
    minDot: 0.955,
  })),
  {
    id: 'dugout',
    title: '선수 벤치 (더그아웃)',
    body: ['감독과 교체 선수들이 경기를 지켜보는 벤치입니다. 투명 지붕과 개별 좌석으로 구성했습니다.'],
    position: [10, 1, 40.3],
    range: 7,
  },
  {
    id: 'store-shirts',
    title: '유니폼 진열대',
    body: ['로고 없는 팬 콘셉트 셔츠 진열대입니다.', '온라인 구매 기능은 아직 구현되지 않았습니다.'],
    position: [63, 1, 113],
    range: 5,
  },
  {
    id: 'store-mannequin',
    title: '유니폼 마네킹',
    body: ['홈 셔츠 콘셉트를 입힌 마네킹입니다. 실제 공식 킷 디자인이 아닙니다.'],
    position: [68, 1.3, 117.5],
    range: 5,
  },
  {
    id: 'store-scarves',
    title: '머플러 월',
    body: ['빨강·흰색·검정 스트라이프 머플러 콘셉트 상품입니다.'],
    position: [87.5, 1.5, 117.5],
    range: 7,
  },
  {
    id: 'store-balls',
    title: '축구공 전시',
    body: ['기념 축구공 전시대입니다. (데모 상품)'],
    position: [82, 1, 108.6],
    range: 5,
  },
  {
    id: 'store-counter',
    title: '계산대 (DEMO)',
    body: ['가상 계산대입니다. 실제 결제나 주문 기능은 없습니다.'],
    position: [56, 1.2, 127.2],
    range: 5,
  },
]

export const INTERACTABLE_BY_ID = Object.fromEntries(INTERACTABLES.map((i) => [i.id, i]))
