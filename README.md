# Theatre of Dreams Virtual Tour (Phase 1)

올드 트래포드에서 영감을 받은 **비공식 팬 제작** 3D 가상 스타디움 투어 프로토타입.
구단·경기장 운영사와 무관하며, 공식 로고/유니폼 이미지/영상/음원을 사용하지 않습니다.
모든 모델과 텍스처는 코드(절차적 모델링 + canvas)로 생성됩니다.

## 실행
```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # 타입 검사 + 프로덕션 빌드 (dist/)
```

## 조작 (3인칭 아바타)
WASD 이동(카메라 기준) · Shift 달리기 · 마우스 카메라 회전(클릭 시 포인터 잠금, 또는 드래그) · 휠 카메라 거리 ·
Space 점프 · E 살펴보기 · C 캐릭터 꾸미기 · M 소리 · 1~7 빠른 이동 · ESC 마우스 해제

모바일(터치): 왼쪽 조이스틱 이동 · 화면 드래그 카메라 회전 · 두 손가락 확대/축소 · 점프/달리기/살펴보기 버튼.
터치 기기에서는 그래픽이 자동으로 '낮음'(그림자 끔, 단순 좌석, 낮은 해상도)으로 시작하며 HUD에서 바꿀 수 있습니다.

## 사운드
발소리·관중 함성·환호는 모두 WebAudio로 실시간 합성합니다(녹음/음원 파일 없음). 브라우저가 오디오를 막으면 소리 없이 동작합니다.

## 구조
- `src/world/layout.ts` — 모든 공간 좌표, 충돌체, 바닥 높이, 구역 판정, 스폰 지점 (단일 기준)
- `src/world/bowlGeometry.ts` — 둥근 사각형 경로를 따라 단면을 스윕하는 관중석/지붕 생성기
- `src/world/textures.ts` — 잔디·라인·벽돌·사인 등 canvas 텍스처
- `src/components/scene/` — StadiumExterior, StadiumInterior(Lobby, LockerRoom, PlayerTunnel), StadiumSeating, StadiumPitch, Scoreboard, MegaStore, LightingSystem
- `src/components/player/PlayerController.tsx` — 카메라 기준 이동, 충돌, 계단, 상호작용, 빠른 이동
- `src/components/player/ThirdPersonCamera.tsx` — 궤도형 3인칭 카메라, 휠 줌, 벽 충돌, 실내 자동 접근, 터널 연출
- `src/components/player/Avatar.tsx` — 절차적 휴머노이드 리그 + Idle/Walk/Run 블렌딩, 발 접지 보정, 닉네임
- `src/components/player/avatarModels.ts` — 체형(모델) 레지스트리 (향후 GLB 모델 추가 지점)
- `src/components/scene/ExteriorDetails.tsx` — 벽돌 기둥·출입 게이트·창 띠·코너 계단탑·광장 조경
- `src/components/scene/StadiumDetails.tsx` — 통로 계단·노란 단 끝선·보미토리(관중석 출입구)·난간·지붕 트러스·투광등·피치 쪽 계단
- `src/audio/` — 합성 사운드 엔진과 구역별 관중 소리 연출
- `src/components/ui/MobileControls.tsx` — 터치 조이스틱/버튼
- `src/state/avatarStore.ts` — 커스터마이징 설정 (브라우저 localStorage에 저장)
- `src/components/ui/` — NavigationUI, Minimap
- `src/data/matchData.ts` — 전광판 데이터 인터페이스 (현재 DEMO provider만 존재)
- `src/data/interactables.ts` — E 키로 볼 수 있는 안내 정보

## 실시간 스코어 연결 (다음 단계)
`MatchDataProvider`를 구현한 provider를 만들어 `useMatchData(provider)`에 넘기면 됩니다.
API 키는 브라우저에 노출하지 말고 별도 백엔드 프록시를 통해 호출하세요.

## 멀티플레이 (온라인에서 만나기)
- 서버: `server/index.mjs` (Node + `ws`). 채널당 최대 100명, 가득 차면 새 채널 자동 생성.
- 위치는 초당 약 10회 전송, 서버는 초당 8회 주변 75m 안의 최대 40명만 보내 줍니다.
- 가까운 20명(그래픽 낮음: 8명)은 애니메이션 아바타, 그 외는 가벼운 실루엣으로 표시합니다.
- 채널 채팅(Enter, 80자, 1.2초당 1회 제한)과 말풍선, 접속자 수 표시, 중복 닉네임 자동 구분(#2).

로컬 실행 (터미널 2개):
```bash
npm run server   # ws://127.0.0.1:8787
npm run dev      # http://127.0.0.1:5173
```
부하 테스트: `node server/loadtest.mjs 100 10`

### 배포 (예: 서버는 Render, 화면은 Vercel)
1. GitHub에 이 폴더를 올립니다.
2. Render → New Web Service → 저장소 선택
   - Build: `npm install` / Start: `node server/index.mjs`
   - 환경변수: `ALLOWED_ORIGINS=https://<vercel 주소>` (다른 사이트에서 접속 차단)
3. Vercel → Import → 같은 저장소, 환경변수 `VITE_MP_URL=wss://<render 주소>` → Deploy
4. 접속 확인: `https://<render 주소>/health`

주의: Render 무료 요금제는 15분간 접속이 없으면 잠들어 첫 접속에 약 1분이 걸립니다.
행사처럼 많은 인원이 동시에 들어올 때는 유료(상시 실행) 인스턴스를 권장합니다.
